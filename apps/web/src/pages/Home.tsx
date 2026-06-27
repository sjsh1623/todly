import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Avatar, Card, FAB, ProgressBar, StatusBar, Skeleton, SkeletonList } from '../shared/ui'
import { PROFILE_COLOR_TO_AVATAR } from '../features/auth/types'
import { useAuthStore } from '../features/auth/store'
import { useHomeSummary } from '../features/tasks'
import type { NeedsAttentionItem } from '../features/tasks'
import { LiveNowCard } from '../features/live'
import { useCreateRoom } from '../features/rooms'
import { NotificationCenter } from '../features/notifications'
import i18n from '../shared/i18n/i18n'

const HEADER_GRADIENT = 'linear-gradient(180deg,#E2EEFD 0%,#F2F6FC 100%)'

function dueLabel(item: NeedsAttentionItem): string {
  if (item.level === 'danger') return i18n.t('home.dueToday', { groupName: item.groupName })
  const days = item.daysOverdue ?? 1
  return i18n.t('home.dueOverdue', { groupName: item.groupName, days })
}

export default function Home() {
  const navigate = useNavigate()
  const { t } = useTranslation()
  const user = useAuthStore((s) => s.user)
  const { data, isLoading } = useHomeSummary()
  const createRoom = useCreateRoom()

  /** Joins/opens the shared live room for a task, then navigates to it. */
  const openRoom = (taskId: string) => {
    createRoom.mutate(taskId, {
      onSuccess: (room) => navigate(`/rooms/${room.id}`),
      onError: () => navigate(`/live/${taskId}`),
    })
  }

  const greeting = data?.greeting
  const greetName = greeting?.name ?? user?.nickname ?? ''
  const needsAttention = data?.needsAttention ?? []
  const groupProgress = data?.groupProgress ?? []
  const liveNow = data?.liveNow ?? []
  const anyLive = liveNow.length > 0

  return (
    <div className="relative min-h-[calc(100vh_-_92px)]" style={{ background: 'var(--color-bg-2)' }}>
      {/* Gradient header backdrop */}
      <div className="absolute left-0 right-0 top-0" style={{ height: 240, background: HEADER_GRADIENT }} />

      <div className="relative">
        <StatusBar />
        <div style={{ padding: '8px 22px 24px' }}>
          {/* Greeting */}
          <div className="flex items-start justify-between" style={{ marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-subtle)' }}>
                {greeting?.phrase ?? t('home.greetingFallback')}
              </div>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-.5px' }}>
                {greetName ? t('home.greetName', { name: greetName }) : ''}
              </h1>
              {greeting?.date && (
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-subtle)', marginTop: 2 }}>
                  {greeting.date}
                </div>
              )}
            </div>
            <div className="flex items-center" style={{ gap: 10 }}>
              <NotificationCenter />
              {user && (
                <Avatar
                  initial={(user.nickname || user.username).charAt(0)}
                  color={PROFILE_COLOR_TO_AVATAR[user.profileColor]}
                  size={44}
                  gradient
                />
              )}
            </div>
          </div>

          {/* 지금 활동 중 — real live sessions, with a live-ticking elapsed timer */}
          <div className="flex items-center" style={{ gap: 7, margin: '0 0 11px 2px' }}>
            <span
              style={{
                width: 7,
                height: 7,
                borderRadius: '50%',
                background: anyLive ? '#2BC4B0' : '#CBD3DF',
                animation: anyLive ? 'tdlDot 1.4s infinite' : undefined,
              }}
              aria-hidden="true"
            />
            <span style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: '.5px', color: anyLive ? '#159B89' : 'var(--color-text-subtle)' }}>
              {t('home.activeNow')}
            </span>
          </div>
          <Card style={{ borderRadius: 24, padding: anyLive ? 16 : 22, marginBottom: 24 }}>
            {anyLive ? (
              <div className="flex flex-col">
                {liveNow.map((entry, i) => (
                  <div key={`${entry.userId}-${entry.taskTitle}`}>
                    {i > 0 && <div style={{ height: 1, background: '#F0F3F8', margin: '14px 0' }} />}
                    <LiveNowCard
                      entry={entry}
                      actionLabel={entry.userId === user?.id ? t('home.inProgress') : t('home.join')}
                      onAction={
                        entry.taskId
                          ? entry.userId === user?.id
                            // My own session: jump to the solo live view.
                            ? () => navigate(`/live/${entry.taskId as string}`)
                            // Someone else's: join/open their shared room.
                            : () => openRoom(entry.taskId as string)
                          : undefined
                      }
                      pulseDelay={i * 0.6}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center text-center" style={{ gap: 6 }}>
                <div
                  className="flex items-center justify-center"
                  style={{ width: 44, height: 44, borderRadius: '50%', background: '#F0F3F8', marginBottom: 4 }}
                  aria-hidden="true"
                >
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#AEB9CC" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 7v5l3 2" />
                    <circle cx="12" cy="12" r="9" />
                  </svg>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text-muted)' }}>
                  {t('home.allResting')}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-subtle)' }}>
                  {t('home.allRestingSubtitle')}
                </div>
              </div>
            )}
          </Card>

          {/* Loading skeleton for the lists below the live card */}
          {isLoading && (
            <div style={{ marginTop: 4 }}>
              <Skeleton width="40%" height={16} style={{ marginBottom: 12 }} />
              <SkeletonList rows={3} />
            </div>
          )}

          {/* 확인이 필요해요 */}
          {needsAttention.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)', margin: '0 2px 12px' }}>
                {t('home.needsAttention')}
              </h2>
              <div className="flex flex-col" style={{ gap: 12, marginBottom: 24 }}>
                {needsAttention.map((item) => (
                  <button
                    key={item.taskId}
                    type="button"
                    onClick={() => navigate(`/groups/${item.groupId}`)}
                    className="text-left flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    style={{
                      gap: 13,
                      background: 'var(--color-card)',
                      borderRadius: 20,
                      padding: '15px 16px',
                      boxShadow: '0 5px 16px rgba(17,40,86,.05)',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        width: 5,
                        height: 40,
                        borderRadius: 3,
                        flex: 'none',
                        background: item.level === 'danger' ? 'var(--color-due)' : 'var(--color-overdue)',
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="truncate" style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--color-text)' }}>
                        {item.title}
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-subtle)', marginTop: 1 }}>
                        {dueLabel(item)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* 함께한 진행률 */}
          {groupProgress.length > 0 && (
            <>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)', margin: '0 2px 12px' }}>
                {t('home.sharedProgress')}
              </h2>
              <div className="flex flex-col" style={{ gap: 12 }}>
                {groupProgress.map((g) => (
                  <button
                    key={g.groupId}
                    type="button"
                    onClick={() => navigate(`/groups/${g.groupId}`)}
                    className="text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    style={{
                      background: 'var(--color-card)',
                      borderRadius: 20,
                      padding: 16,
                      boxShadow: '0 5px 16px rgba(17,40,86,.05)',
                    }}
                  >
                    <div className="flex items-center justify-between" style={{ marginBottom: 11 }}>
                      <div style={{ fontSize: 14.5, fontWeight: 800, color: 'var(--color-text)' }}>{g.name}</div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: '#1366CE' }}>{g.progress.percent}%</div>
                    </div>
                    <ProgressBar value={g.progress.percent} />
                    <div className="flex items-center justify-between" style={{ marginTop: 11 }}>
                      <div className="flex">
                        {g.members.slice(0, 4).map((m, i) => (
                          <div key={m.userId} style={{ marginLeft: i === 0 ? 0 : -8, borderRadius: '50%', border: '2px solid #fff' }}>
                            <Avatar
                              initial={(m.nickname || '?').charAt(0)}
                              color={PROFILE_COLOR_TO_AVATAR[m.profileColor]}
                              size={24}
                            />
                          </div>
                        ))}
                      </div>
                      <div style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-text-subtle)' }}>
                        {t('home.progressDone', { total: g.progress.total, done: g.progress.done })}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </>
          )}

          {/* Empty fallback when nothing to show */}
          {!isLoading && needsAttention.length === 0 && groupProgress.length === 0 && (
            <div
              className="flex flex-col items-center justify-center text-center"
              style={{ border: '1.5px dashed #D6DEEA', borderRadius: 20, padding: '40px 20px', marginTop: 4 }}
            >
              <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 16 }}>
                {t('home.emptyTitle')}
              </p>
              <button
                type="button"
                onClick={() => navigate('/groups/new')}
                style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-primary-strong)' }}
              >
                {t('home.createGroup')}
              </button>
            </div>
          )}
        </div>
      </div>

      <FAB onClick={() => navigate('/tasks/new')} aria-label={t('home.addTask')} />
    </div>
  )
}
