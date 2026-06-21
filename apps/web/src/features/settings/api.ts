import { isAxiosError } from 'axios'
import { api } from '../../shared/lib/api'
import type { ApiError, User } from '../auth/types'
import type {
  ChangePasswordPayload,
  ConnectedAccount,
  ContactPayload,
  UpdateMePayload,
} from './types'

export async function getMe(): Promise<User> {
  const { data } = await api.get<User>('/me')
  return data
}

export async function updateMe(payload: UpdateMePayload): Promise<User> {
  const { data } = await api.patch<User>('/me', payload)
  return data
}

export async function changePassword(payload: ChangePasswordPayload): Promise<void> {
  await api.post('/me/password', payload)
}

export async function getConnectedAccounts(): Promise<ConnectedAccount[]> {
  const { data } = await api.get<ConnectedAccount[]>('/me/connected-accounts')
  return data
}

/** Fetches the export JSON and triggers a browser file download. */
export async function exportData(): Promise<void> {
  const { data } = await api.get('/me/export')
  const json = JSON.stringify(data, null, 2)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'todly-export.json'
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export async function deleteAccount(password?: string): Promise<void> {
  await api.delete('/me', { data: password ? { password } : undefined })
}

export async function contact(payload: ContactPayload): Promise<void> {
  await api.post('/support/contact', payload)
}

const ERROR_MESSAGES: Record<string, string> = {
  INVALID_CREDENTIALS: '현재 비밀번호가 올바르지 않습니다',
  NO_PASSWORD_SET: '소셜 로그인 계정은 비밀번호가 없어요',
}

/** Maps a settings API error to a user-facing Korean message. */
export function getSettingsErrorMessage(
  error: unknown,
  fallback = '문제가 발생했어요. 다시 시도해 주세요',
): string {
  if (isAxiosError<ApiError>(error)) {
    const code = error.response?.data?.code
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
    if (error.response?.data?.message) return error.response.data.message
  }
  return fallback
}
