import { isAxiosError } from 'axios'
import { api } from '../../shared/lib/api'
import i18n from '../../shared/i18n/i18n'
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

/** Maps a settings API error to a localized, user-facing message. */
export function getSettingsErrorMessage(
  error: unknown,
  fallback = i18n.t('errors.generic'),
): string {
  if (isAxiosError<ApiError>(error)) {
    const code = error.response?.data?.code
    if (code) {
      const message = i18n.t(`errorSettings.${code}`, { defaultValue: '' })
      if (message) return message
    }
    if (error.response?.data?.message) return error.response.data.message
  }
  return fallback
}
