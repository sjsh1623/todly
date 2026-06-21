import type { ProfileColor } from '../auth/types'

export type RoomStatus = 'live' | 'ended'

/** A participant currently (or formerly) present in a live room. */
export type RoomParticipant = {
  userId: string
  nickname: string
  profileColor: ProfileColor
  isHost: boolean
  joinedAt: string
}

/** A cheer message in the room stream (body and/or a standalone emoji). */
export type RoomMessage = {
  id: string
  roomId: string
  senderId: string
  nickname: string
  profileColor: ProfileColor
  body?: string
  emoji?: string
  createdAt: string
}

/** A shared photo. url/thumbUrl are API paths rendered directly in <img>. */
export type RoomPhoto = {
  id: string
  roomId: string
  uploaderId: string
  nickname: string
  url: string
  thumbUrl?: string
  createdAt: string
}

/** Full room snapshot returned by GET /live-rooms/{id}. */
export type Room = {
  id: string
  title: string
  status: RoomStatus
  startedAt: string
  host: RoomParticipant
  participantCount: number
  participants: RoomParticipant[]
  messages: RoomMessage[]
  photos: RoomPhoto[]
}

/** A trimmed room shape some endpoints return inside { room }. */
export type RoomSummary = Pick<
  Room,
  'id' | 'title' | 'status' | 'startedAt' | 'participantCount'
> & {
  host?: RoomParticipant
  taskId?: string
}

// ---- STOMP envelope + payloads for /topic/rooms/{roomId} ----

export type RoomEventType =
  | 'room.joined'
  | 'room.left'
  | 'room.participants'
  | 'room.message'
  | 'room.photo'
  | 'room.ended'

export type RoomEnvelope<P = unknown> = {
  scope: 'room'
  id: string
  type: RoomEventType
  payload: P
  at: string
}

export type RoomJoinedPayload = { participant: RoomParticipant }
export type RoomLeftPayload = { userId: string }
export type RoomParticipantsPayload = {
  participants: RoomParticipant[]
  participantCount: number
}
export type RoomMessagePayload = RoomMessage
export type RoomPhotoPayload = RoomPhoto
export type RoomEndedPayload = { roomId: string }

/** Body for sending a cheer (REST or STOMP /app/rooms/{id}/cheer). */
export type CheerInput = { body?: string; emoji?: string }
