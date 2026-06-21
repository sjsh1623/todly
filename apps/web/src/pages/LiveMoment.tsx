import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { PROFILE_COLOR_TO_AVATAR } from '../features/auth/types'
import {
  useElapsed,
  useLiveStore,
  usePauseLive,
  useStopLive,
  selectSessionForTask,
} from '../features/live'
import { useToggleComplete } from '../features/tasks'

const AVATAR_GRADIENT: Record<'blue' | 'mint' | 'orange' | 'purple', string> = {
  blue: 'linear-gradient(140deg,#5FE3F0,#2E86E6)',
  mint: 'linear-gradient(140deg,#7FF0E0,#2BC4B0)',
  orange: 'linear-gradient(140deg,#FFC58C,#FF9D52)',
  purple: 'linear-gradient(140deg,#9C8DF0,#6B5BD0)',
}

const SCREEN_BG =
  'radial-gradient(120% 80% at 50% 12%,#1B6BD6 0%,#0E4FA8 42%,#0A2E63 78%,#071E45 100%)'

function startTimeLabel(iso: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const h = d.getHours()
  const m = d.getMinutes()
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** SCR-06 "그 순간 · 라이브 시작" — full-screen live session for one task. */
export default function LiveMoment() {
  const { taskId } = useParams<{ taskId: string }>()
  const navigate = useNavigate()
  const sessions = useLiveStore((s) => s.sessions)
  const session = useMemo(
    () => (taskId ? selectSessionForTask(sessions, taskId) : undefined),
    [sessions, taskId],
  )

  const pauseLive = usePauseLive()
  const stopLive = useStopLive()
  const toggleComplete = useToggleComplete()
  const [busy, setBusy] = useState(false)

  const status = session?.status ?? 'active'
  const stopwatch = useElapsed(session?.startedAt, session?.pausedSeconds, status, 'stopwatch')

  const goBack = () => {
    if (window.history.length > 1) navigate(-1)
    else navigate('/')
  }

  if (!session || !taskId) {
    return (
      <div
        className="min-h-screen flex flex-col items-center justify-center text-center"
        style={{ background: SCREEN_BG, padding: 30 }}
      >
        <div style={{ fontSize: 16, fontWeight: 800, color: '#fff', marginBottom: 8 }}>
          진행 중인 라이브가 없어요
        </div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.7)', marginBottom: 24 }}>
          이미 끝났거나 시작되지 않았어요
        </div>
        <button
          type="button"
          onClick={goBack}
          style={{ padding: '12px 22px', borderRadius: 16, background: 'rgba(255,255,255,.16)', color: '#fff', fontSize: 14, fontWeight: 800 }}
        >
          돌아가기
        </button>
      </div>
    )
  }

  const avatarColor = PROFILE_COLOR_TO_AVATAR[session.profileColor]
  const isPaused = status === 'paused'
  const groupId = session.groupId ?? ''

  const handlePause = () => {
    pauseLive.mutate({ taskId, groupId, paused: !isPaused })
  }

  const handleComplete = () => {
    setBusy(true)
    stopLive.mutate(
      { taskId, groupId },
      {
        onSuccess: () => {
          // Mark the task complete after stopping the live session.
          toggleComplete.mutate(
            { taskId, groupId, currentStatus: 'in_progress' },
            { onSettled: () => goBack() },
          )
        },
        onError: () => {
          setBusy(false)
          goBack()
        },
      },
    )
  }

  return (
    <div className="relative min-h-screen" style={{ background: SCREEN_BG, overflow: 'hidden' }}>
      {/* Top bar with close */}
      <div className="relative flex items-center justify-between" style={{ height: 54, padding: '17px 22px 0', zIndex: 30 }}>
        <button
          type="button"
          onClick={goBack}
          aria-label="닫기"
          className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          style={{ width: 38, height: 38, borderRadius: 13, background: 'rgba(255,255,255,.14)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.4} strokeLinecap="round">
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </div>

      {/* Center: pulsing avatar + live badge + title + stopwatch */}
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ padding: '0 30px' }}>
        <div className="relative flex items-center justify-center" style={{ width: 170, height: 170, marginBottom: 30 }}>
          {!isPaused &&
            [0, 0.9, 1.8].map((delay) => (
              <span
                key={delay}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  width: 140,
                  height: 140,
                  borderRadius: '50%',
                  border: '2px solid rgba(95,227,240,.5)',
                  animation: `tdlPulse 2.6s ${delay}s infinite`,
                }}
              />
            ))}
          <div
            className="flex items-center justify-center text-white"
            style={{
              width: 132,
              height: 132,
              borderRadius: '50%',
              background: AVATAR_GRADIENT[avatarColor],
              fontSize: 46,
              fontWeight: 800,
              boxShadow: '0 0 60px rgba(95,227,240,.6)',
              animation: isPaused ? undefined : 'tdlGlow 2.6s infinite',
            }}
          >
            {(session.nickname || '?').charAt(0)}
          </div>
        </div>

        <div
          className="inline-flex items-center"
          style={{
            gap: 8,
            background: 'rgba(95,227,240,.16)',
            border: '1px solid rgba(95,227,240,.4)',
            padding: '8px 16px',
            borderRadius: 30,
            marginBottom: 18,
          }}
        >
          <span
            aria-hidden="true"
            style={{ width: 8, height: 8, borderRadius: '50%', background: '#5FE3F0', animation: 'tdlDot 1.2s infinite' }}
          />
          <span style={{ fontSize: 12, fontWeight: 800, letterSpacing: '.5px', color: '#9EEEF7' }}>
            {isPaused ? '일시정지됨' : '지금 라이브'}
          </span>
        </div>

        <div style={{ fontSize: 30, fontWeight: 800, color: '#fff', letterSpacing: '-.6px', marginBottom: 6, textAlign: 'center' }}>
          {session.taskTitle}
        </div>
        <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,.7)', marginBottom: 26 }}>
          {startTimeLabel(session.startedAt)} 시작 · 그룹
        </div>

        <div
          aria-live="polite"
          style={{ fontFamily: "'Sora',sans-serif", fontSize: 54, fontWeight: 800, color: '#fff', letterSpacing: '-.02em', fontVariantNumeric: 'tabular-nums' }}
        >
          {stopwatch}
        </div>
      </div>

      {/* Bottom controls: 일시정지 / 완료 */}
      <div className="absolute flex items-center" style={{ left: 24, right: 24, bottom: 46, gap: 12 }}>
        <button
          type="button"
          onClick={handlePause}
          disabled={pauseLive.isPending || busy}
          className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 disabled:opacity-60"
          style={{
            flex: 1,
            height: 58,
            borderRadius: 20,
            gap: 7,
            background: 'rgba(255,255,255,.12)',
            border: '1px solid rgba(255,255,255,.2)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
          }}
        >
          {isPaused ? (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" stroke="none">
              <path d="M8 5v14l11-7z" />
            </svg>
          ) : (
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" stroke="none">
              <rect x="7" y="6" width="3.4" height="12" rx="1.2" />
              <rect x="13.6" y="6" width="3.4" height="12" rx="1.2" />
            </svg>
          )}
          {isPaused ? '다시 시작' : '일시정지'}
        </button>
        <button
          type="button"
          onClick={handleComplete}
          disabled={busy || stopLive.isPending}
          className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:opacity-60"
          style={{
            flex: 1.2,
            height: 58,
            borderRadius: 20,
            gap: 7,
            background: '#fff',
            color: '#1366CE',
            fontSize: 15,
            fontWeight: 800,
            boxShadow: '0 14px 34px rgba(0,0,0,.3)',
          }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1366CE" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 6.5" />
          </svg>
          {busy ? '완료 중…' : '완료'}
        </button>
      </div>
    </div>
  )
}
