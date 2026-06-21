import { isAxiosError } from 'axios'
import { api } from '../../shared/lib/api'
import i18n from '../../shared/i18n/i18n'
import type {
  ApiError,
  AuthResponse,
  AuthTokens,
  LoginPayload,
  SignupPayload,
  User,
} from './types'

export async function signup(payload: SignupPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/signup', payload)
  return data
}

export async function login(payload: LoginPayload): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>('/auth/login', payload)
  return data
}

export async function refresh(refreshToken: string): Promise<AuthTokens> {
  const { data } = await api.post<AuthTokens>('/auth/refresh', { refreshToken })
  return data
}

export async function logout(refreshToken: string): Promise<void> {
  await api.post('/auth/logout', { refreshToken })
}

export async function oauth(provider: string, idToken: string): Promise<AuthResponse> {
  const { data } = await api.post<AuthResponse>(`/auth/oauth/${provider}`, { idToken })
  return data
}

export async function checkUsername(username: string): Promise<boolean> {
  const { data } = await api.get<{ available: boolean }>('/auth/check-username', {
    params: { username },
  })
  return data.available
}

export async function me(): Promise<User> {
  const { data } = await api.get<User>('/me')
  return data
}

/** Optional endpoint; backend may add it later. */
export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/password/reset-request', { email })
}

/** Maps an axios/API error to a localized, user-facing message. */
export function getApiErrorMessage(error: unknown, fallback = i18n.t('errors.generic')): string {
  if (isAxiosError<ApiError>(error)) {
    const code = error.response?.data?.code
    if (code) {
      const message = i18n.t(`errorAuth.${code}`, { defaultValue: '' })
      if (message) return message
    }
    if (error.response?.data?.message) return error.response.data.message
  }
  return fallback
}
