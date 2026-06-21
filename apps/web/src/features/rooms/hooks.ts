import { useEffect } from 'react'
import {
  useMutation,
  useQuery,
  useQueryClient,
  type QueryClient,
} from '@tanstack/react-query'
import * as roomsApi from './api'
import { subscribe, publish } from '../live/stompClient'
import type {
  CheerInput,
  Room,
  RoomEndedPayload,
  RoomEnvelope,
  RoomJoinedPayload,
  RoomLeftPayload,
  RoomMessage,
  RoomMessagePayload,
  RoomParticipant,
  RoomParticipantsPayload,
  RoomPhoto,
  RoomPhotoPayload,
} from './types'

export const roomKeys = {
  all: ['rooms'] as const,
  detail: (id: string) => ['rooms', 'detail', id] as const,
  mine: ['rooms', 'mine'] as const,
}

// ---------------------------------------------------------------------------
// Realtime merge strategy
//
// The room screen's source of truth is the TanStack Query cache entry for
// roomKeys.detail(id), seeded by the initial GET. STOMP events for
// /topic/rooms/{id} are merged immutably into that cached Room:
//   - room.message / room.photo  → append (de-duped by id; replaces an
//                                   optimistic temp entry sharing the id)
//   - room.joined                → upsert the participant, bump count
//   - room.left                  → drop the participant, decrement count
//   - room.participants          → authoritative replace of the list + count
//   - room.ended                 → status = 'ended'
// Components read the merged Room reactively via useRoom(id). No separate store
// is needed because the cache already gives us reactivity + the GET seed.
// ---------------------------------------------------------------------------

function upsertParticipant(room: Room, p: RoomParticipant): Room {
  const exists = room.participants.some((x) => x.userId === p.userId)
  const participants = exists
    ? room.participants.map((x) => (x.userId === p.userId ? p : x))
    : [...room.participants, p]
  return { ...room, participants, participantCount: participants.length }
}

function removeParticipant(room: Room, userId: string): Room {
  const participants = room.participants.filter((x) => x.userId !== userId)
  return { ...room, participants, participantCount: participants.length }
}

function appendMessage(room: Room, msg: RoomMessage): Room {
  if (room.messages.some((m) => m.id === msg.id)) {
    return { ...room, messages: room.messages.map((m) => (m.id === msg.id ? msg : m)) }
  }
  return { ...room, messages: [...room.messages, msg] }
}

function appendPhoto(room: Room, photo: RoomPhoto): Room {
  if (room.photos.some((p) => p.id === photo.id)) {
    return { ...room, photos: room.photos.map((p) => (p.id === photo.id ? photo : p)) }
  }
  return { ...room, photos: [...room.photos, photo] }
}

/** Applies a single decoded room envelope to the cached Room snapshot. */
export function applyRoomEvent(qc: QueryClient, env: RoomEnvelope) {
  const key = roomKeys.detail(env.id)
  const current = qc.getQueryData<Room>(key)
  if (!current) return

  switch (env.type) {
    case 'room.joined': {
      const p = (env.payload as RoomJoinedPayload).participant
      if (p) qc.setQueryData<Room>(key, upsertParticipant(current, p))
      break
    }
    case 'room.left': {
      const { userId } = env.payload as RoomLeftPayload
      if (userId) qc.setQueryData<Room>(key, removeParticipant(current, userId))
      break
    }
    case 'room.participants': {
      const p = env.payload as RoomParticipantsPayload
      qc.setQueryData<Room>(key, {
        ...current,
        participants: p.participants ?? current.participants,
        participantCount: p.participantCount ?? p.participants?.length ?? current.participantCount,
      })
      break
    }
    case 'room.message': {
      const msg = env.payload as RoomMessagePayload
      if (msg?.id) qc.setQueryData<Room>(key, appendMessage(current, msg))
      break
    }
    case 'room.photo': {
      const photo = env.payload as RoomPhotoPayload
      if (photo?.id) qc.setQueryData<Room>(key, appendPhoto(current, photo))
      break
    }
    case 'room.ended': {
      const { roomId } = env.payload as RoomEndedPayload
      if (!roomId || roomId === current.id) {
        qc.setQueryData<Room>(key, { ...current, status: 'ended' })
      }
      break
    }
  }
}

/** Initial room snapshot (GET). Realtime events merge into this cache entry. */
export function useRoom(roomId: string | undefined) {
  return useQuery({
    queryKey: roomId ? roomKeys.detail(roomId) : roomKeys.all,
    queryFn: () => roomsApi.getRoom(roomId as string),
    enabled: Boolean(roomId),
    staleTime: Infinity, // kept fresh by STOMP; don't refetch & clobber merges
  })
}

/** Subscribes to /topic/rooms/{id} and merges events into the room cache. */
export function useRoomRealtime(roomId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!roomId) return
    const unsub = subscribe(`/topic/rooms/${roomId}`, (message) => {
      try {
        const env = JSON.parse(message.body) as RoomEnvelope
        applyRoomEvent(qc, env)
      } catch (err) {
        console.error('[rooms] failed to handle event', err)
      }
    })
    return unsub
  }, [roomId, qc])
}

export function useCreateRoom() {
  return useMutation({ mutationFn: (taskId: string) => roomsApi.createRoom(taskId) })
}

export function useJoinRoom() {
  return useMutation({ mutationFn: (roomId: string) => roomsApi.joinRoom(roomId) })
}

export function useLeaveRoom() {
  return useMutation({ mutationFn: (roomId: string) => roomsApi.leaveRoom(roomId) })
}

/**
 * Sends a cheer. Prefers STOMP publish to /app/rooms/{id}/cheer (the broadcast
 * room.message echo will arrive back over the topic); falls back to REST when
 * the socket isn't connected. Either way the broadcast is the source of truth,
 * so we don't optimistically write here — the room screen owns the optimistic
 * append so it can show the sender's own message instantly.
 */
export function useSendCheer(roomId: string | undefined) {
  return useMutation({
    mutationFn: async (input: CheerInput) => {
      if (!roomId) throw new Error('NO_ROOM')
      const sent = publish(`/app/rooms/${roomId}/cheer`, input)
      if (sent) return null
      return roomsApi.sendCheer(roomId, input)
    },
  })
}

export function useUploadPhoto(roomId: string | undefined) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (file: File) => {
      if (!roomId) throw new Error('NO_ROOM')
      return roomsApi.uploadPhoto(roomId, file)
    },
    onSuccess: (photo) => {
      if (!roomId) return
      const key = roomKeys.detail(roomId)
      const current = qc.getQueryData<Room>(key)
      if (current) qc.setQueryData<Room>(key, appendPhoto(current, photo))
    },
  })
}

export function useEndRoom() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (roomId: string) => roomsApi.endRoom(roomId),
    onSuccess: (_data, roomId) => {
      const key = roomKeys.detail(roomId)
      const current = qc.getQueryData<Room>(key)
      if (current) qc.setQueryData<Room>(key, { ...current, status: 'ended' })
    },
  })
}
