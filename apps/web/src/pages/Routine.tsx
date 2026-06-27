import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { FAB, StatusBar, EmptyState, SkeletonList } from '../shared/ui'
import {
  useRoutines,
  useCompleteRoutine,
  useSkipRoutine,
  routineMetaLine,
  minutesUntil,
} from '../features/routines'
import type { Routine } from '../features/routines'
import { useStartLive } from '../features/live'
import { useCreateRoom } from '../features/rooms'
import RoutineCreateSheet from '../features/routines/RoutineCreateSheet'

/** The next routine to do today: not done, ordered by nextRunAt (soonest first). */
function pickNextUp(routines: Routine[]): Routine | undefined {
  const pending = routines.filter((r) => r.isActive && !r.todayDone)
  if (pending.length === 0) return undefined
  return [...pending].sort((a, b) => {
    const at = a.nextRunAt ? new Date(a.nextRunAt).getTime() : Infinity
    const bt = b.nextRunAt ? new Date(b.nextRunAt).getTime() : Infinity
    return at - bt
  })[0]
}

export default function Routine() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { data: routines, isLoading } = useRoutines()
  const completeRoutine = useCompleteRoutine()
  const skipRoutine = useSkipRoutine()
  const startLive = useStartLive()
  const createRoom = useCreateRoom()
  const [createOpen, setCreateOpen] = useState(false)

  const active = useMemo(() => (routines ?? []).filter((r) => r.isActive), [routines])
  const total = active.length
  const doneCount = active.filter((r) => r.todayDone).length
  const remaining = total - doneCount
  const nextUp = useMemo(() => pickNextUp(active), [active])

  // Hero ring geometry.
  const RADIUS = 36
  const CIRC = 2 * Math.PI * RADIUS
  const ratio = total === 0 ? 0 : doneCount / total
  const dashOffset = CIRC * (1 - ratio)

  const heroTitle =
    total === 0
      ? '루틴을 시작해 볼까요'
      : remaining === 0
        ? '오늘 루틴 완료!'
        : ratio >= 0.6
          ? '거의 다 왔어요'
          : '오늘도 화이팅'
  const heroSub =
    total === 0
      ? '+ 버튼으로 첫 루틴을 추가하세요.'
      : remaining === 0
        ? '모든 루틴을 마쳤어요. 멋져요!'
        : `오늘 ${remaining}개 남았어요.${nextUp ? ` 다음은 ${nextUp.title}예요.` : ''}`

  const bestStreak = active.reduce((max, r) => Math.max(max, r.streak?.current ?? 0), 0)

  /** Starts a live session for the next-up routine's task, then opens its room. */
  const startRoutineLive = (r: Routine) => {
    if (!r.todayTaskId) return
    const groupId = r.groupId ?? ''
    startLive.mutate(
      { taskId: r.todayTaskId, groupId },
      {
        onSettled: () => {
          createRoom.mutate(r.todayTaskId as string, {
            onSuccess: (room) => navigate(`/rooms/${room.id}`),
            onError: () => navigate(`/live/${r.todayTaskId}`),
          })
        },
      },
    )
  }

  return (
    <div className="relative min-h-[calc(100vh_-_92px)]" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <div style={{ padding: '10px 22px 120px' }}>
        {/* Header */}
        <div className="flex items-start justify-between" style={{ marginBottom: 18 }}>
          <div>
            <h1 style={{ fontSize: 27, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-.5px' }}>루틴</h1>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: '#9AA7BC', marginTop: 2 }}>오늘의 루틴</div>
          </div>
          {bestStreak > 0 && (
            <div className="inline-flex items-center" style={{ gap: 6, background: '#FFF1E6', padding: '8px 13px', borderRadius: 14 }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="#FF9D52">
                <path d="M12 2c1 4-2 5-2 8a4 4 0 0 0 8 0c0-1-.3-2-1-3 2 1 4 4 4 7a8 8 0 1 1-16 0c0-5 5-7 7-12z" />
              </svg>
              <span style={{ fontSize: 13, fontWeight: 800, color: '#E07B2E' }}>{bestStreak}일째</span>
            </div>
          )}
        </div>

        {/* Hero */}
        {total > 0 && (
          <div
            style={{
              background: 'linear-gradient(150deg,#1366CE,#0E4FA8)',
              borderRadius: 26,
              padding: 22,
              color: '#fff',
              marginBottom: 24,
              boxShadow: '0 18px 38px rgba(19,102,206,.28)',
              display: 'flex',
              alignItems: 'center',
              gap: 20,
            }}
          >
            <div style={{ position: 'relative', width: 84, height: 84, flex: 'none' }}>
              <svg width="84" height="84" viewBox="0 0 84 84">
                <circle cx="42" cy="42" r={RADIUS} fill="none" stroke="rgba(255,255,255,.22)" strokeWidth={9} />
                <circle
                  cx="42"
                  cy="42"
                  r={RADIUS}
                  fill="none"
                  stroke="#5FE3F0"
                  strokeWidth={9}
                  strokeLinecap="round"
                  strokeDasharray={CIRC}
                  strokeDashoffset={dashOffset}
                  transform="rotate(-90 42 42)"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <div style={{ fontSize: 22, fontWeight: 800 }}>{doneCount}/{total}</div>
              </div>
            </div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800 }}>{heroTitle}</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.8)', marginTop: 3 }}>{heroSub}</div>
            </div>
          </div>
        )}

        {/* Cards */}
        {isLoading ? (
          <SkeletonList rows={4} />
        ) : active.length === 0 ? (
          <EmptyState
            className="mt-1"
            title={t('empty.routineTitle')}
            subtitle={t('empty.routineSubtitle')}
          />
        ) : (
          <div className="flex flex-col" style={{ gap: 12 }}>
            {active.map((r) => {
              const isNext = nextUp?.id === r.id
              const mins = minutesUntil(r.nextRunAt)
              return (
                <div
                  key={r.id}
                  className="flex items-center"
                  style={{
                    background: '#fff',
                    borderRadius: 18,
                    padding: 15,
                    gap: 13,
                    boxShadow: isNext ? '0 8px 20px rgba(19,102,206,.12)' : '0 5px 16px rgba(17,40,86,.05)',
                    border: isNext ? '1.5px solid #CFE2FB' : undefined,
                  }}
                >
                  {/* Icon tile */}
                  <div
                    className="flex items-center justify-center"
                    style={{ width: 42, height: 42, borderRadius: 14, background: r.todayDone ? '#E2F8F4' : '#EAF2FE', flex: 'none' }}
                    aria-hidden="true"
                  >
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={r.todayDone ? '#159B89' : '#1366CE'} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M19.5 12a7.5 7.5 0 1 1-2.2-5.3" />
                      <path d="M17.4 3.7v3.4h-3.4" />
                    </svg>
                  </div>

                  {/* Title + meta */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="truncate"
                      style={{
                        fontSize: 14.5,
                        fontWeight: 800,
                        color: r.todayDone ? '#AEB9CC' : 'var(--color-text)',
                        textDecoration: r.todayDone ? 'line-through' : undefined,
                      }}
                    >
                      {r.title}
                    </div>
                    <div style={{ fontSize: 11.5, fontWeight: isNext && !r.todayDone ? 700 : 600, color: isNext && !r.todayDone ? '#1366CE' : '#9AA7BC' }}>
                      {isNext && !r.todayDone
                        ? `다음 차례${mins != null ? ` · ${mins}분` : ''}`
                        : routineMetaLine(r)}
                      {r.streak?.current > 0 && !isNext && (
                        <span style={{ marginLeft: 8, color: '#E07B2E', fontWeight: 800 }}>· {r.streak.current}일째</span>
                      )}
                    </div>
                  </div>

                  {/* Action */}
                  {r.todayDone ? (
                    <div className="flex items-center justify-center" style={{ width: 26, height: 26, borderRadius: 9, background: '#46D38A', flex: 'none' }} aria-label="완료됨">
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M5 12.5l4.5 4.5L19 6.5" />
                      </svg>
                    </div>
                  ) : isNext && r.todayTaskId ? (
                    <button
                      type="button"
                      onClick={() => startRoutineLive(r)}
                      disabled={startLive.isPending || createRoom.isPending}
                      className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      style={{ gap: 5, padding: '9px 14px', borderRadius: 13, background: '#1366CE', color: '#fff', fontSize: 11.5, fontWeight: 800, flex: 'none' }}
                    >
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" stroke="none"><path d="M7 5l11 7-11 7z" /></svg>
                      시작
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => completeRoutine.mutate(r.id)}
                      onContextMenu={(e) => {
                        e.preventDefault()
                        skipRoutine.mutate(r.id)
                      }}
                      aria-label={`${r.title} 완료 표시`}
                      className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                      style={{ width: 26, height: 26, borderRadius: 9, border: '2.5px solid #DDE3EC', background: 'transparent', flex: 'none' }}
                    />
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      <FAB onClick={() => setCreateOpen(true)} aria-label="루틴 추가" />

      {createOpen && <RoutineCreateSheet onClose={() => setCreateOpen(false)} />}
    </div>
  )
}
