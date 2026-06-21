import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useNotifications,
  useUnreadCount,
  useMarkRead,
  useMarkAllRead,
} from './hooks'
import type { Notification } from './types'
import { relativeTime } from '../../shared/lib/relativeTime'
import { EmptyState, SkeletonList } from '../../shared/ui'

/** Small icon per notification type. */
function typeIcon(type: string) {
  const common = { width: 16, height: 16, viewBox: '0 0 24 24', fill: 'none', strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const }
  if (type === 'live.started') return <svg {...common} stroke="#1366CE"><path d="M7 5l11 7-11 7z" fill="#1366CE" stroke="none" /></svg>
  if (type === 'task.completed') return <svg {...common} stroke="#159B89"><path d="M5 12.5l4.5 4.5L19 6.5" /></svg>
  if (type === 'comment') return <svg {...common} stroke="#6B5BD0"><path d="M4 5h16v11H8l-4 4z" /></svg>
  if (type.startsWith('friend')) return <svg {...common} stroke="#E07B2E"><circle cx="9" cy="8" r="3.5" /><path d="M3 20a6 6 0 0 1 12 0M18 8v6M21 11h-6" /></svg>
  return <svg {...common} stroke="#1366CE"><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" /><path d="M10 19a2 2 0 0 0 4 0" /></svg>
}

/** A bell button with an unread badge that opens a notification list sheet. */
export function NotificationCenter({ tone = 'dark' }: { tone?: 'dark' | 'light' }) {
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const unread = useUnreadCount()

  const stroke = tone === 'light' ? '#fff' : '#14233A'

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={unread > 0 ? `알림 ${unread}개` : '알림'}
        className="relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
        style={{ width: 40, height: 40, borderRadius: 13, background: tone === 'light' ? 'rgba(255,255,255,.14)' : '#fff', boxShadow: tone === 'light' ? undefined : '0 4px 12px rgba(20,50,90,.06)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6z" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span
            aria-hidden="true"
            className="absolute flex items-center justify-center"
            style={{ top: 4, right: 4, minWidth: 16, height: 16, padding: '0 4px', borderRadius: 8, background: '#FF6B6B', color: '#fff', fontSize: 10, fontWeight: 800, border: '2px solid #fff' }}
          >
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && <NotificationSheet onClose={() => setOpen(false)} navigate={navigate} />}
    </>
  )
}

function NotificationSheet({
  onClose,
  navigate,
}: {
  onClose: () => void
  navigate: ReturnType<typeof useNavigate>
}) {
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } = useNotifications()
  const markRead = useMarkRead()
  const markAllRead = useMarkAllRead()

  const items = useMemo(() => data?.pages.flatMap((p) => p.items) ?? [], [data])

  const sentinelRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el) return
    const obs = new IntersectionObserver((entries) => {
      if (entries[0]?.isIntersecting && hasNextPage && !isFetchingNextPage) void fetchNextPage()
    })
    obs.observe(el)
    return () => obs.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Esc closes the sheet (WCAG 2.1.2: no keyboard trap).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const onTap = (n: Notification) => {
    if (!n.isRead) markRead.mutate(n.id)
    if (n.link) {
      onClose()
      navigate(n.link)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(20,35,58,.4)' }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="알림"
    >
      <div
        className="w-full"
        style={{ maxWidth: 420, background: '#fff', borderTopLeftRadius: 26, borderTopRightRadius: 26, maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ width: 40, height: 4, borderRadius: 2, background: '#E0E6EF', margin: '16px auto 0' }} aria-hidden="true" />
        <div className="flex items-center justify-between" style={{ padding: '14px 22px 12px' }}>
          <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)' }}>알림</h2>
          {items.some((n) => !n.isRead) && (
            <button
              type="button"
              onClick={() => markAllRead.mutate()}
              className="focus:outline-none"
              style={{ fontSize: 12.5, fontWeight: 800, color: '#1366CE' }}
            >
              모두 읽음
            </button>
          )}
        </div>

        <div style={{ overflowY: 'auto', padding: '0 16px 24px' }}>
          {isLoading ? (
            <div style={{ padding: '8px 0' }}>
              <SkeletonList rows={4} />
            </div>
          ) : items.length === 0 ? (
            <EmptyState
              bordered={false}
              title="새 알림이 없어요"
              subtitle="활동이 생기면 여기로 알려드릴게요"
            />
          ) : (
            <div className="flex flex-col" style={{ gap: 8 }}>
              {items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  onClick={() => onTap(n)}
                  className="text-left flex items-start focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                  style={{
                    gap: 12,
                    background: n.isRead ? '#fff' : '#F5F9FF',
                    borderRadius: 16,
                    padding: '13px 14px',
                    boxShadow: '0 4px 14px rgba(17,40,86,.04)',
                  }}
                >
                  <div className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: '#EEF2F7', flex: 'none' }} aria-hidden="true">
                    {typeIcon(n.type)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--color-text)' }}>{n.title}</div>
                    {n.body && (
                      <div className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text-muted)', marginTop: 1 }}>
                        {n.body}
                      </div>
                    )}
                    <div style={{ fontSize: 11, fontWeight: 600, color: '#AEB9CC', marginTop: 3 }}>{relativeTime(n.createdAt)}</div>
                  </div>
                  {!n.isRead && (
                    <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: '50%', background: '#1366CE', flex: 'none', marginTop: 4 }} />
                  )}
                </button>
              ))}
              <div ref={sentinelRef} style={{ height: 1 }} />
              {isFetchingNextPage && (
                <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 600, color: 'var(--color-text-subtle)', padding: '12px 0' }}>불러오는 중…</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
