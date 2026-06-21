import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PROFILE_COLOR_TO_AVATAR, type ProfileColor } from '../features/auth/types'
import { useAuthStore } from '../features/auth/store'
import { useElapsed } from '../features/live'
import {
  useRoom,
  useRoomRealtime,
  useJoinRoom,
  useSendCheer,
  useUploadPhoto,
  useEndRoom,
} from '../features/rooms'
import type { RoomMessage, RoomParticipant, RoomPhoto } from '../features/rooms'

const SCREEN_BG = 'linear-gradient(170deg,#0A2E63 0%,#0E4FA8 50%,#10407E 100%)'

const AVATAR_GRADIENT: Record<'blue' | 'mint' | 'orange' | 'purple', string> = {
  blue: 'linear-gradient(140deg,#5FE3F0,#2E86E6)',
  mint: 'linear-gradient(140deg,#7FF0E0,#2BC4B0)',
  orange: 'linear-gradient(140deg,#FFC58C,#FF9D52)',
  purple: 'linear-gradient(140deg,#9C8DF0,#6B5BD0)',
}

const AVATAR_FLAT: Record<'blue' | 'mint' | 'orange' | 'purple', string> = {
  blue: '#2E86E6',
  mint: '#2BC4B0',
  orange: '#FF9D52',
  purple: '#6B5BD0',
}

const RING_COLOR: Record<'blue' | 'mint' | 'orange' | 'purple', string> = {
  blue: 'rgba(95,227,240,.5)',
  mint: 'rgba(95,227,240,.5)',
  orange: 'rgba(255,157,82,.5)',
  purple: 'rgba(156,141,240,.5)',
}

const QUICK_EMOJI = ['🔥', '💪', '🎉']

function gradientFor(color: ProfileColor): string {
  return AVATAR_GRADIENT[PROFILE_COLOR_TO_AVATAR[color]]
}
function flatFor(color: ProfileColor): string {
  return AVATAR_FLAT[PROFILE_COLOR_TO_AVATAR[color]]
}
function ringFor(color: ProfileColor): string {
  return RING_COLOR[PROFILE_COLOR_TO_AVATAR[color]]
}
function initialOf(name: string): string {
  return (name || '?').charAt(0)
}

/** SCR-07 "라이브 룸" — multi-participant room with cheers, photos, presence. */
export default function LiveRoom() {
  const { t } = useTranslation()
  const { id: roomId } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const currentUserId = useAuthStore((s) => s.user?.id)
  const me = useAuthStore((s) => s.user)

  const { data: room, isLoading, isError } = useRoom(roomId)
  useRoomRealtime(roomId)

  const joinRoom = useJoinRoom()
  const sendCheer = useSendCheer(roomId)
  const uploadPhoto = useUploadPhoto(roomId)
  const endRoom = useEndRoom()

  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamEndRef = useRef<HTMLDivElement>(null)
  const [draft, setDraft] = useState('')
  const [viewerPhoto, setViewerPhoto] = useState<RoomPhoto | null>(null)
  // Optimistic messages we appended locally before the broadcast echoes back.
  const [optimistic, setOptimistic] = useState<RoomMessage[]>([])

  // Join on mount (idempotent server-side). We do NOT leave on unmount: leaving
  // automatically when the screen unmounts is too aggressive (a backgrounded tab
  // or transient navigation would yank the user out). Leaving is an explicit
  // action via the back button; ending the room is host-only via the kebab.
  const joinedRef = useRef(false)
  useEffect(() => {
    if (!roomId || joinedRef.current) return
    joinedRef.current = true
    joinRoom.mutate(roomId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId])

  const isHost = Boolean(room && currentUserId && room.host.userId === currentUserId)
  const ended = room?.status === 'ended'

  const elapsed = useElapsed(room?.startedAt, 0, ended ? 'paused' : 'active', 'short')

  // Most recent shared photo (for the share card).
  const latestPhoto = useMemo<RoomPhoto | null>(() => {
    if (!room || room.photos.length === 0) return null
    return room.photos[room.photos.length - 1]
  }, [room])

  // Merge server messages with still-pending optimistic ones (deduped by id).
  const messages = useMemo<RoomMessage[]>(() => {
    if (!room) return []
    const serverIds = new Set(room.messages.map((m) => m.id))
    const pending = optimistic.filter((m) => !serverIds.has(m.id))
    return [...room.messages, ...pending]
  }, [room, optimistic])

  // Drop optimistic entries once their real counterparts arrive.
  useEffect(() => {
    if (!room || optimistic.length === 0) return
    const serverIds = new Set(room.messages.map((m) => m.id))
    if (optimistic.some((m) => serverIds.has(m.id))) {
      setOptimistic((prev) => prev.filter((m) => !serverIds.has(m.id)))
    }
  }, [room, optimistic])

  // Auto-scroll the stream to the newest message.
  useEffect(() => {
    streamEndRef.current?.scrollIntoView({ block: 'end' })
  }, [messages.length])

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  const pushOptimistic = (body?: string, emoji?: string) => {
    if (!me) return
    const temp: RoomMessage = {
      id: `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      roomId: roomId ?? '',
      senderId: me.id,
      nickname: me.nickname,
      profileColor: me.profileColor,
      body,
      emoji,
      createdAt: new Date().toISOString(),
    }
    setOptimistic((prev) => [...prev, temp])
  }

  const handleSend = () => {
    const body = draft.trim()
    if (!body || ended) return
    setDraft('')
    pushOptimistic(body, undefined)
    sendCheer.mutate({ body })
  }

  const handleEmoji = (emoji: string) => {
    if (ended) return
    pushOptimistic(undefined, emoji)
    sendCheer.mutate({ emoji })
  }

  const handlePickPhoto = () => fileInputRef.current?.click()
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) uploadPhoto.mutate(file)
  }

  const handleEnd = () => {
    if (!roomId) return
    endRoom.mutate(roomId)
  }

  // ---- Loading / error / not-found ----
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: SCREEN_BG }}>
        <span style={{ fontSize: 14, fontWeight: 700, color: 'rgba(255,255,255,.8)' }}>{t('liveRoom.loading')}</span>
      </div>
    )
  }

  if (isError || !room || !roomId) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-center"
        style={{ background: SCREEN_BG, padding: 30 }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
          {t('liveRoom.notFoundTitle')}
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.7)', marginBottom: 24 }}>
          {t('liveRoom.notFoundSubtitle')}
        </div>
        <button
          type="button"
          onClick={goBack}
          style={{ padding: '12px 22px', borderRadius: 16, background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: 14, fontWeight: 800 }}
        >
          {t('liveRoom.back')}
        </button>
      </div>
    )
  }

  const participants = room.participants
  const others = participants.filter((p) => !p.isHost)

  return (
    <div className="relative min-h-screen flex flex-col" style={{ background: SCREEN_BG, overflow: 'hidden' }}>
      {/* Header: back, "라이브 룸" badge, kebab/end */}
      <div
        className="relative flex items-center justify-between"
        style={{ height: 54, padding: '17px 22px 0', zIndex: 30, flex: 'none' }}
      >
        <button
          type="button"
          onClick={goBack}
          aria-label={t('liveRoom.backAria')}
          className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.14)' }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
            <path d="M15 5l-7 7 7 7" />
          </svg>
        </button>
        <div
          className="inline-flex items-center"
          style={{ gap: 7, background: 'rgba(255,255,255,.16)', padding: '6px 13px', borderRadius: 20 }}
        >
          <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: '#5FE3F0', animation: ended ? undefined : 'tdlDot 1.2s infinite' }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.4px', color: '#fff' }}>{t('liveRoom.badge')}</span>
        </div>
        {isHost && !ended ? (
          <button
            type="button"
            onClick={handleEnd}
            disabled={endRoom.isPending}
            aria-label={t('liveRoom.endLive')}
            className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-60"
            style={{ width: 34, height: 34, borderRadius: '50%', background: 'rgba(255,255,255,.14)' }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        ) : (
          <div style={{ width: 34, height: 34 }} aria-hidden="true" />
        )}
      </div>

      {/* Title block */}
      <div style={{ padding: '14px 22px 0', flex: 'none' }}>
        <div style={{ color: '#fff' }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-.5px' }}>{room.title}</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.7)' }}>
            {t('liveRoom.runningTogether', { count: room.participantCount })}{elapsed ? ` · ${elapsed}` : ''}
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 min-h-0 overflow-y-auto" style={{ padding: '12px 22px 0' }}>
        {/* Participants row */}
        <div
          className="flex items-end"
          style={{ gap: 18, overflowX: 'auto', paddingBottom: 6, marginBottom: 14 }}
        >
          {/* Host first, then others */}
          {[room.host, ...others.filter((p) => p.userId !== room.host.userId)].map((p, i) => (
            <ParticipantAvatar key={p.userId} participant={p} big={p.isHost} pulseDelay={(i % 3) * 0.7} />
          ))}
        </div>

        {/* Photo-share card */}
        {latestPhoto && (
          <button
            type="button"
            onClick={() => setViewerPhoto(latestPhoto)}
            className="flex items-center w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-white/50"
            style={{
              gap: 11,
              background: 'rgba(255,255,255,.1)',
              border: '1px solid rgba(255,255,255,.14)',
              borderRadius: 18,
              padding: 10,
              marginBottom: 10,
            }}
          >
            <img
              src={latestPhoto.thumbUrl || latestPhoto.url}
              alt={t('liveRoom.photoAlt', { nickname: latestPhoto.nickname })}
              style={{ width: 50, height: 50, borderRadius: 13, objectFit: 'cover', flex: 'none', background: '#1d4f8c' }}
            />
            <div className="flex-1 min-w-0" style={{ color: '#fff' }}>
              <div className="truncate" style={{ fontSize: 13, fontWeight: 800 }}>
                {t('liveRoom.photoShared', { nickname: latestPhoto.nickname })}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,.6)' }}>{t('liveRoom.tapToView')}</div>
            </div>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,.6)" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        )}

        {/* Cheer message stream */}
        {messages.length > 0 && (
          <div
            className="flex flex-col"
            style={{
              gap: 10,
              background: 'rgba(255,255,255,.1)',
              border: '1px solid rgba(255,255,255,.14)',
              borderRadius: 18,
              padding: '13px 15px',
              marginBottom: 14,
            }}
          >
            {messages.map((m) => (
              <div key={m.id} className="flex items-center" style={{ gap: 9 }}>
                <div
                  className="flex items-center justify-center text-white"
                  style={{ width: 26, height: 26, borderRadius: '50%', background: flatFor(m.profileColor), fontSize: 10, fontWeight: 800, flex: 'none' }}
                  aria-hidden="true"
                >
                  {initialOf(m.nickname)}
                </div>
                <div style={{ fontSize: 13, color: '#fff' }}>
                  <b style={{ fontWeight: 800 }}>{m.nickname}</b>
                  &nbsp;&nbsp;
                  {m.body}
                  {m.body && m.emoji ? ' ' : ''}
                  {m.emoji}
                </div>
              </div>
            ))}
            <div ref={streamEndRef} />
          </div>
        )}

        {/* Ended state */}
        {ended && (
          <div
            className="flex flex-col items-center text-center"
            style={{ padding: '24px 16px', marginBottom: 14, background: 'rgba(255,255,255,.08)', borderRadius: 18 }}
          >
            <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 14 }}>{t('liveRoom.ended')}</div>
            <button
              type="button"
              onClick={goBack}
              style={{ padding: '11px 20px', borderRadius: 14, background: '#fff', color: '#1366CE', fontSize: 13.5, fontWeight: 800 }}
            >
              {t('liveRoom.back')}
            </button>
          </div>
        )}
      </div>

      {/* Quick emoji reactions + composer */}
      {!ended && (
        <div style={{ padding: '8px 18px', flex: 'none' }}>
          <div className="flex items-center" style={{ gap: 9 }}>
            <div className="flex" style={{ gap: 7 }}>
              <button
                type="button"
                onClick={handlePickPhoto}
                aria-label={t('liveRoom.sharePhoto')}
                className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                style={{ width: 46, height: 46, borderRadius: 16, background: '#5FE3F0', flex: 'none' }}
              >
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#0A2E63" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
                  <circle cx="12" cy="13" r="3.5" />
                </svg>
              </button>
              {QUICK_EMOJI.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => handleEmoji(emoji)}
                  aria-label={t('liveRoom.sendCheerEmoji', { emoji })}
                  className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
                  style={{ width: 46, height: 46, borderRadius: 16, background: 'rgba(255,255,255,.14)', fontSize: 22, flex: 'none' }}
                >
                  <span aria-hidden="true">{emoji}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="flex items-center" style={{ gap: 9, marginTop: 9, paddingBottom: 18 }}>
            <label htmlFor="cheer-input" className="sr-only">
              {t('liveRoom.cheerLabel')}
            </label>
            <input
              id="cheer-input"
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSend()
              }}
              placeholder={t('liveRoom.cheerPlaceholder')}
              className="flex-1"
              style={{
                height: 46,
                borderRadius: 16,
                background: 'rgba(255,255,255,.14)',
                padding: '0 16px',
                fontSize: 13.5,
                fontWeight: 600,
                color: '#fff',
                border: 'none',
                outline: 'none',
              }}
            />
            <button
              type="button"
              onClick={handleSend}
              disabled={!draft.trim()}
              aria-label={t('liveRoom.send')}
              className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-50"
              style={{ width: 46, height: 46, borderRadius: 16, background: '#1366CE', flex: 'none', boxShadow: '0 8px 20px rgba(19,102,206,.4)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 12l16-7-7 16-2.5-6.5L4 12z" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        className="sr-only"
        aria-hidden="true"
        tabIndex={-1}
      />

      {/* Full-image viewer */}
      {viewerPhoto && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('liveRoom.sharedPhoto')}
          onClick={() => setViewerPhoto(null)}
          className="fixed inset-0 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,.86)', zIndex: 60, padding: 20 }}
        >
          <button
            type="button"
            onClick={() => setViewerPhoto(null)}
            aria-label={t('liveRoom.close')}
            className="absolute focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{ top: 24, right: 24, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
          <img
            src={viewerPhoto.url}
            alt={t('liveRoom.photoAlt', { nickname: viewerPhoto.nickname })}
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 16, objectFit: 'contain' }}
          />
        </div>
      )}
    </div>
  )
}

function ParticipantAvatar({
  participant,
  big,
  pulseDelay,
}: {
  participant: RoomParticipant
  big?: boolean
  pulseDelay?: number
}) {
  const { t } = useTranslation()
  const size = big ? 88 : 64
  const fontSize = big ? 30 : 24
  return (
    <div className="flex flex-col items-center" style={{ gap: 7, flex: 'none' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${ringFor(participant.profileColor)}`,
            animation: `tdlPulse 2.4s ${pulseDelay ?? 0}s infinite`,
          }}
        />
        <div
          className="flex items-center justify-center text-white"
          style={{
            width: size,
            height: size,
            borderRadius: '50%',
            background: gradientFor(participant.profileColor),
            fontSize,
            fontWeight: 800,
            boxShadow: big ? '0 0 40px rgba(95,227,240,.5)' : undefined,
          }}
          aria-hidden="true"
        >
          {initialOf(participant.nickname)}
        </div>
      </div>
      {participant.isHost ? (
        <div style={{ background: 'rgba(0,0,0,.25)', padding: '4px 12px', borderRadius: 14, fontSize: 12, fontWeight: 700, color: '#fff' }}>
          {t('liveRoom.host', { nickname: participant.nickname })}
        </div>
      ) : (
        <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>{participant.nickname}</div>
      )}
    </div>
  )
}
