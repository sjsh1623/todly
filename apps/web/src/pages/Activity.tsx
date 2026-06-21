import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar, StatusBar, EmptyState, SkeletonList } from '../shared/ui'
import { PROFILE_COLOR_TO_AVATAR } from '../features/auth/types'
import { useGroups } from '../features/groups'
import { useActivities } from '../features/activity'
import type { Activity } from '../features/activity'
import { useCreateRoom } from '../features/rooms'
import { relativeTime } from '../shared/lib/relativeTime'

/** Builds the "{nickname}님이 {object}을 {verb}" sentence per activity type. */
function describe(a: Activity): { lead: string; object?: string; tail: string } {
  const name = a.actor?.nickname ?? '누군가'
  const title = a.targetTitle ?? a.groupName ?? ''
  switch (a.type) {
    case 'task.completed':
      return { lead: `${name}님이 `, object: title, tail: '를 끝냈어요' }
    case 'task.created':
      return { lead: `${name}님이 `, object: title, tail: '를 추가했어요' }
    case 'live.started':
      return { lead: `${name}님이 `, object: title, tail: '을 시작했어요' }
    case 'live.ended':
      return { lead: `${name}님이 `, object: title, tail: '을 마쳤어요' }
    case 'milestone': {
      const percent = (a.meta?.percent as number | undefined) ?? undefined
      return {
        lead: '',
        object: a.groupName ?? title,
        tail: percent != null ? `가 ${percent}%에 도달했어요` : '에 도달했어요',
      }
    }
    case 'member.joined':
      return { lead: `${name}님이 `, object: a.groupName ?? title, tail: '에 참여했어요' }
    default:
      return { lead: `${name}님이 `, object: title, tail: ' 활동했어요' }
  }
}

function isLive(a: Activity): boolean {
  return a.type === 'live.started' && a.meta?.live !== false
}

export default function Activity() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const { data: groups } = useGroups()
  const createRoom = useCreateRoom()

  // undefined chip = "전체"
  const [groupFilter, setGroupFilter] = useState<string | undefined>(undefined)

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useActivities(groupFilter)

  const items = useMemo(
    () => data?.pages.flatMap((p) => p.items) ?? [],
    [data],
  )

  // Infinite scroll via a sentinel at the bottom of the list.
  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) {
        void fetchNextPage()
      }
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  const openRoom = (taskId: string) => {
    createRoom.mutate(taskId, {
      onSuccess: (room) => navigate(`/rooms/${room.id}`),
      onError: () => navigate(`/live/${taskId}`),
    })
  }

  const chipStyle = (active: boolean): React.CSSProperties => ({
    padding: '9px 16px',
    borderRadius: 14,
    fontSize: 12.5,
    fontWeight: 700,
    background: active ? '#14233A' : '#fff',
    color: active ? '#fff' : '#7C8AA0',
    boxShadow: active ? undefined : '0 3px 10px rgba(20,50,90,.05)',
    flex: 'none',
  })

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <div style={{ padding: '10px 22px 90px' }}>
        <h1 style={{ fontSize: 27, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-.5px', marginBottom: 16 }}>
          활동
        </h1>

        {/* Filter chips */}
        <div className="flex" style={{ gap: 8, marginBottom: 24, overflowX: 'auto' }} role="tablist" aria-label="활동 필터">
          <button type="button" role="tab" aria-selected={!groupFilter} onClick={() => setGroupFilter(undefined)} style={chipStyle(!groupFilter)}>
            전체
          </button>
          {(groups ?? []).map((g) => (
            <button
              key={g.id}
              type="button"
              role="tab"
              aria-selected={groupFilter === g.id}
              onClick={() => setGroupFilter(g.id)}
              style={chipStyle(groupFilter === g.id)}
            >
              {g.name}
            </button>
          ))}
        </div>

        {/* Timeline */}
        {isLoading ? (
          <SkeletonList rows={5} />
        ) : items.length === 0 ? (
          <EmptyState
            className="mt-1"
            title={t('empty.activityTitle')}
            subtitle={t('empty.activitySubtitle')}
          />
        ) : (
          <div style={{ position: 'relative' }}>
            {/* Timeline rail */}
            <div aria-hidden="true" style={{ position: 'absolute', left: 19, top: 8, bottom: 18, width: 2, background: '#E0E6EF' }} />
            {items.map((a, i) => {
              const sentence = describe(a)
              const live = isLive(a)
              const completedCount = a.meta?.completedCount as number | undefined
              const percent = a.meta?.percent as number | undefined
              return (
                <div key={a.id} style={{ position: 'relative', display: 'flex', gap: 16, marginBottom: i === items.length - 1 ? 0 : 22 }}>
                  {/* Actor node */}
                  <div style={{ position: 'relative', width: 40, height: 40, flex: 'none', zIndex: 1 }}>
                    {live && (
                      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '2px solid #2E86E6', animation: 'tdlPulse 2s infinite' }} />
                    )}
                    <div style={{ border: '3px solid var(--color-bg-2)', borderRadius: '50%' }}>
                      <Avatar
                        initial={(a.actor?.nickname ?? '?').charAt(0)}
                        color={a.actor ? PROFILE_COLOR_TO_AVATAR[a.actor.profileColor] : 'blue'}
                        size={40}
                      />
                    </div>
                  </div>

                  {/* Body */}
                  <div style={{ flex: 1, paddingTop: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, color: 'var(--color-text)', fontWeight: 600 }}>
                      {sentence.lead && <b style={{ fontWeight: 800 }}>{sentence.lead.replace('님이 ', '')}</b>}
                      {sentence.lead && '님이 '}
                      {sentence.object && <b style={{ fontWeight: 800 }}>{sentence.object}</b>}
                      {sentence.tail}
                    </div>

                    {/* Completed badge */}
                    {a.type === 'task.completed' && completedCount != null && (
                      <div className="inline-flex items-center" style={{ gap: 6, marginTop: 6, background: '#E2F8F4', padding: '5px 11px', borderRadius: 11 }}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#159B89" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12.5l4.5 4.5L19 6.5" />
                        </svg>
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#159B89' }}>{completedCount}개 완료</span>
                      </div>
                    )}

                    {/* Live · 참여 */}
                    {live && (
                      <button
                        type="button"
                        onClick={() => a.targetTaskId && openRoom(a.targetTaskId)}
                        disabled={!a.targetTaskId}
                        className="inline-flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                        style={{ gap: 6, marginTop: 6, background: '#EAF2FE', padding: '5px 11px', borderRadius: 11 }}
                      >
                        <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: '#2E86E6', animation: 'tdlDot 1.4s infinite' }} />
                        <span style={{ fontSize: 11, fontWeight: 800, color: '#1366CE' }}>지금 라이브 · 참여</span>
                      </button>
                    )}

                    {/* Milestone progress bar */}
                    {a.type === 'milestone' && percent != null && (
                      <div style={{ height: 6, borderRadius: 4, background: '#EDF1F7', overflow: 'hidden', marginTop: 9, maxWidth: 170 }}>
                        <div style={{ width: `${percent}%`, height: '100%', background: 'linear-gradient(90deg,#34D9C4,#1366CE)', borderRadius: 4 }} />
                      </div>
                    )}

                    <div style={{ fontSize: 11, fontWeight: 600, color: '#9AA7BC', marginTop: 7 }}>
                      {relativeTime(a.createdAt)}
                      {!groupFilter && a.groupName ? ` · ${a.groupName}` : ''}
                    </div>
                  </div>
                </div>
              )
            })}

            <div ref={sentinelRef} style={{ height: 1 }} />
            {isFetchingNextPage && (
              <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--color-text-subtle)', padding: '16px 0' }}>
                불러오는 중…
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
