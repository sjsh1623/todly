import { useNavigate } from 'react-router-dom'
import { Avatar, Button, Card, Heatmap, SkeletonList, EmptyState } from '../shared/ui'
import { useAuthStore, useLogout } from '../features/auth'
import { PROFILE_COLOR_TO_AVATAR } from '../features/auth/types'
import { useStats, useHeatmap, useRecentActivity } from '../features/stats'
import type { RecentActivity } from '../features/stats'
import { relativeTime } from '../shared/lib/relativeTime'

const STAT_COLORS = {
  completionRate: '#1366CE',
  currentStreak: '#E07B2E',
  lifeScore: '#159B89',
  routineScore: '#6B5BD0',
} as const

function StatTile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div
      style={{
        background: '#fff',
        borderRadius: 20,
        padding: 17,
        boxShadow: '0 6px 20px rgba(17,40,86,.06)',
      }}
    >
      <div style={{ fontSize: 30, fontWeight: 800, color, letterSpacing: '-.5px' }}>{value}</div>
      <div style={{ fontSize: 12, fontWeight: 600, color: '#9AA7BC', marginTop: 2 }}>{label}</div>
    </div>
  )
}

function activityIcon(type: RecentActivity['type']) {
  if (type === 'task_added') {
    return (
      <span
        className="flex items-center justify-center"
        style={{ width: 30, height: 30, borderRadius: 10, background: '#EAF2FE', flex: 'none' }}
        aria-hidden="true"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#1366CE" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 5v14M5 12h14" />
        </svg>
      </span>
    )
  }
  return (
    <span
      className="flex items-center justify-center"
      style={{ width: 30, height: 30, borderRadius: 10, background: '#E2F8F4', flex: 'none' }}
      aria-hidden="true"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#159B89" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 6.5" />
      </svg>
    </span>
  )
}

function MenuRow({
  icon,
  label,
  onClick,
}: {
  icon: React.ReactNode
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center justify-between focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{ background: '#fff', borderRadius: 18, padding: '15px 16px', boxShadow: '0 5px 16px rgba(17,40,86,.05)' }}
    >
      <span className="flex items-center" style={{ gap: 12 }}>
        {icon}
        <span style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{label}</span>
      </span>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#C2CBD8" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 6l6 6-6 6" />
      </svg>
    </button>
  )
}

export default function Profile() {
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)
  const logout = useLogout()
  const stats = useStats()
  const heatmap = useHeatmap(16)
  const recent = useRecentActivity(10)

  const handleLogout = () => {
    logout.mutate(undefined, { onSettled: () => navigate('/login', { replace: true }) })
  }

  const s = stats.data
  const groupCount = s?.groupCount ?? 0

  return (
    <div style={{ paddingBottom: 120 }}>
      {/* Blue header backdrop */}
      <div
        style={{
          position: 'absolute',
          inset: '0 0 auto 0',
          height: 250,
          background: 'linear-gradient(160deg,#1366CE 0%,#0E4FA8 100%)',
        }}
        aria-hidden="true"
      />
      <div style={{ position: 'relative', padding: '64px 22px 0' }}>
        {/* Header */}
        <div className="flex flex-col items-center text-center" style={{ color: '#fff', marginBottom: 22 }}>
          {user && (
            <div style={{ marginBottom: 13, border: '3px solid rgba(255,255,255,.4)', borderRadius: '50%', boxShadow: '0 12px 30px rgba(0,0,0,.2)' }}>
              <Avatar
                initial={user.nickname.charAt(0) || '?'}
                color={PROFILE_COLOR_TO_AVATAR[user.profileColor]}
                size={88}
                gradient
              />
            </div>
          )}
          <h1 style={{ fontSize: 23, fontWeight: 800 }}>{user?.nickname ?? '프로필'}</h1>
          {user && (
            <p style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.78)', marginTop: 2 }}>
              @{user.username} · 그룹 {groupCount}개
            </p>
          )}
        </div>

        {/* Stat tiles */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 }}>
          <StatTile value={`${s?.completionRate ?? 0}%`} label="완료율" color={STAT_COLORS.completionRate} />
          <StatTile value={`${s?.currentStreak ?? 0}`} label="연속 일수" color={STAT_COLORS.currentStreak} />
          <StatTile value={`${s?.lifeScore ?? 0}`} label="라이프 점수" color={STAT_COLORS.lifeScore} />
          <StatTile value={`${s?.routineScore ?? 0}`} label="루틴 점수" color={STAT_COLORS.routineScore} />
        </div>

        {/* 꾸준함 card */}
        <Card style={{ borderRadius: 22, padding: 18, marginBottom: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 4 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>꾸준함</div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1366CE' }}>
              올해 {s?.yearlyCount ?? 0}회 완료
            </div>
          </div>
          <div style={{ fontSize: 11.5, fontWeight: 600, color: '#9AA7BC', marginBottom: 15 }}>
            최근 16주 동안의 활동
          </div>
          <Heatmap days={heatmap.data?.days ?? []} weeks={16} legend />
        </Card>

        {/* 꾸준함 자세히 → routine consistency */}
        <MenuRow
          label="꾸준함 자세히"
          onClick={() => navigate('/consistency')}
          icon={
            <span className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: '#E2F8F4' }} aria-hidden="true">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#159B89" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 19V5M4 19h16M8 16l3-4 3 2 4-6" />
              </svg>
            </span>
          }
        />

        {/* 최근 활동 */}
        <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)', margin: '20px 2px 12px' }}>
          최근 활동
        </div>
        <div className="flex flex-col" style={{ gap: 10 }}>
          {recent.isLoading && <SkeletonList rows={3} />}
          {recent.data?.length === 0 && (
            <EmptyState bordered={false} title="아직 활동이 없어요" />
          )}
          {recent.data?.map((a, i) => (
            <div
              key={`${a.at}-${i}`}
              className="flex items-center"
              style={{ background: '#fff', borderRadius: 16, padding: '13px 15px', boxShadow: '0 4px 14px rgba(17,40,86,.05)', gap: 12 }}
            >
              {activityIcon(a.type)}
              <div style={{ flex: 1, fontSize: 13, fontWeight: 700, color: 'var(--color-text)' }}>{a.title}</div>
              <span style={{ fontSize: 11, fontWeight: 600, color: '#AEB9CC' }}>{relativeTime(a.at)}</span>
            </div>
          ))}
        </div>

        {/* Settings / menu */}
        <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', margin: '24px 4px 11px' }}>설정</div>
        <div className="flex flex-col" style={{ gap: 12 }}>
          <MenuRow
            label="친구"
            onClick={() => navigate('/friends')}
            icon={
              <span className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: '#EAF2FE' }} aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#1366CE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="8" r="3.5" />
                  <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
                  <path d="M18 8v6M21 11h-6" />
                </svg>
              </span>
            }
          />
          <MenuRow
            label="설정"
            onClick={() => navigate('/settings')}
            icon={
              <span className="flex items-center justify-center" style={{ width: 32, height: 32, borderRadius: 10, background: '#EEF2F7' }} aria-hidden="true">
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="#5A6B82" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="12" cy="12" r="3" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
                </svg>
              </span>
            }
          />
          <Button variant="secondary" onClick={handleLogout} disabled={logout.isPending} style={{ color: '#FF6B6B', height: 52, borderRadius: 16 }}>
            {logout.isPending ? '로그아웃 중…' : '로그아웃'}
          </Button>
        </div>
      </div>
    </div>
  )
}
