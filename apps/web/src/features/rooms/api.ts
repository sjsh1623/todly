import { api } from '../../shared/lib/api'
import type { CheerInput, Room, RoomMessage, RoomPhoto, RoomSummary } from './types'

/** Creates a room for a task (idempotent-join: returns existing if already open). */
export async function createRoom(taskId: string): Promise<RoomSummary> {
  const { data } = await api.post<{ room: RoomSummary }>('/live-rooms', { taskId })
  return data.room
}

/** Joins a room (no-op if already a participant). */
export async function joinRoom(roomId: string): Promise<RoomSummary> {
  const { data } = await api.post<{ room: RoomSummary }>(`/live-rooms/${roomId}/join`)
  return data.room
}

export async function leaveRoom(roomId: string): Promise<void> {
  await api.post(`/live-rooms/${roomId}/leave`)
}

/** Full room snapshot for the room screen. */
export async function getRoom(roomId: string): Promise<Room> {
  const { data } = await api.get<Room>(`/live-rooms/${roomId}`)
  return data
}

export async function listMyRooms(): Promise<RoomSummary[]> {
  const { data } = await api.get<RoomSummary[]>('/live-rooms', { params: { scope: 'mine' } })
  return data
}

/** Posts a cheer message (text and/or emoji) via REST. */
export async function sendCheer(roomId: string, input: CheerInput): Promise<RoomMessage> {
  const { data } = await api.post<{ message: RoomMessage }>(`/live-rooms/${roomId}/messages`, input)
  return data.message
}

/** Uploads a photo via multipart/form-data (field "file"). */
export async function uploadPhoto(roomId: string, file: File): Promise<RoomPhoto> {
  const form = new FormData()
  form.append('file', file)
  const { data } = await api.post<{ photo: RoomPhoto }>(`/live-rooms/${roomId}/photos`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  })
  return data.photo
}

export async function endRoom(roomId: string): Promise<void> {
  await api.post(`/live-rooms/${roomId}/end`)
}
