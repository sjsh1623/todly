import { api } from '../../shared/lib/api'
import type { LiveSession } from './types'

export async function startLive(taskId: string): Promise<LiveSession> {
  const { data } = await api.post<{ session: LiveSession }>(`/tasks/${taskId}/live/start`)
  return data.session
}

export async function pauseLive(taskId: string, paused: boolean): Promise<LiveSession> {
  const { data } = await api.post<{ session: LiveSession }>(`/tasks/${taskId}/live/pause`, {
    paused,
  })
  return data.session
}

export async function stopLive(taskId: string): Promise<void> {
  await api.post(`/tasks/${taskId}/live/stop`)
}

export async function sendHeartbeat(): Promise<void> {
  await api.post('/presence/heartbeat')
}
