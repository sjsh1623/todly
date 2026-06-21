import { api } from '../../shared/lib/api'
import type { NotificationPage, NotificationSettings } from './types'

const PAGE_LIMIT = 20

export async function getNotifications(cursor?: string | null): Promise<NotificationPage> {
  const { data } = await api.get<NotificationPage>('/me/notifications', {
    params: { cursor: cursor ?? undefined, limit: PAGE_LIMIT },
  })
  return data
}

export async function markRead(id: string): Promise<void> {
  await api.post(`/me/notifications/${id}/read`)
}

export async function markAllRead(): Promise<void> {
  await api.post('/me/notifications/read-all')
}

export async function getSettings(): Promise<NotificationSettings> {
  const { data } = await api.get<NotificationSettings>('/me/notification-settings')
  return data
}

export async function updateSettings(
  patch: Partial<NotificationSettings>,
): Promise<NotificationSettings> {
  const { data } = await api.patch<NotificationSettings>('/me/notification-settings', patch)
  return data
}
