import { isAxiosError } from 'axios'
import { api } from '../../shared/lib/api'
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

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: '이메일 또는 비밀번호가 올바르지 않습니다',
  EMAIL_TAKEN: '이미 가입된 이메일입니다',
  USERNAME_TAKEN: '이미 사용 중인 아이디입니다',
}

/** Maps an axios/API error to a user-facing Korean message. */
export function getApiErrorMessage(error: unknown, fallback = '문제가 발생했어요. 다시 시도해 주세요'): string {
  if (isAxiosError<ApiError>(error)) {
    const code = error.response?.data?.code
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
    if (error.response?.data?.message) return error.response.data.message
  }
  return fallback
}
