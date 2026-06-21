import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type InternalAxiosRequestConfig,
} from 'axios'
import { authStore } from '../../features/auth/store'
import type { AuthTokens } from '../../features/auth/types'

const baseURL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1'

export const api: AxiosInstance = axios.create({ baseURL })

/**
 * A bare client (no interceptors) used by the refresh call itself so that a
 * 401 from /auth/refresh never re-enters the refresh logic and loops forever.
 */
const refreshClient: AxiosInstance = axios.create({ baseURL })

type RetriableConfig = InternalAxiosRequestConfig & { _retry?: boolean }

// Request interceptor: inject the current access token.
api.interceptors.request.use((config) => {
  const token = authStore.getState().accessToken
  if (token) {
    config.headers.set('Authorization', `Bearer ${token}`)
  }
  return config
})

// Prevent stampedes: many in-flight requests share a single refresh promise.
let refreshPromise: Promise<AuthTokens> | null = null

function performRefresh(): Promise<AuthTokens> {
  if (refreshPromise) return refreshPromise

  const { refreshToken } = authStore.getState()
  if (!refreshToken) {
    return Promise.reject(new Error('NO_REFRESH_TOKEN'))
  }

  refreshPromise = refreshClient
    .post<AuthTokens>('/auth/refresh', { refreshToken })
    .then((res) => {
      authStore.getState().setTokens(res.data)
      return res.data
    })
    .finally(() => {
      refreshPromise = null
    })

  return refreshPromise
}

function redirectToLogin() {
  authStore.getState().logout()
  if (window.location.pathname !== '/login') {
    window.location.assign('/login')
  }
}

// Response interceptor: on 401, refresh once and retry the original request.
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined

    const isUnauthorized = error.response?.status === 401
    // A 401 from the auth endpoints themselves (login/signup/refresh) is a real
    // credential/validation error, not an expired access token. Never funnel
    // these through the token-refresh+retry path, which would otherwise mask the
    // original error code (e.g. INVALID_CREDENTIALS) behind a generic failure.
    const isAuthCall = original?.url?.startsWith('/auth/')

    if (!isUnauthorized || !original || original._retry || isAuthCall) {
      return Promise.reject(error)
    }

    original._retry = true

    try {
      const tokens = await performRefresh()
      original.headers.set('Authorization', `Bearer ${tokens.accessToken}`)
      return api(original)
    } catch (refreshError) {
      redirectToLogin()
      return Promise.reject(refreshError)
    }
  },
)

/** Helper to type a plain request and unwrap the data. */
export async function request<T>(config: AxiosRequestConfig): Promise<T> {
  const res = await api.request<T>(config)
  return res.data
}
