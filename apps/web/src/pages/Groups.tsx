import { useNavigate } from 'react-router-dom'
import { Avatar, Button, Card, FAB, ProgressBar, StatusBar } from '../shared/ui'
import { useGroups } from '../features/groups'
import { PROFILE_COLOR_TO_AVATAR } from '../features/auth/types'
import type { GroupListItem } from '../features/groups'

function GroupCard({ group, onClick }: { group: GroupListItem; onClick: () => void }) {
  const { percent, done, total } = group.progress
  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      aria-label={`${group.name} 그룹 열기, 진행률 ${percent}%`}
      className="cursor-pointer transition-transform active:scale-[.99] focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
      style={{ borderRadius: 22, padding: 18 }}
    >
      <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>{group.name}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-primary-strong)' }}>
          {percent}%
        </div>
      </div>

      <div style={{ marginBottom: 12 }}>
        <ProgressBar value={percent} />
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center">
          {group.members.slice(0, 4).map((m, i) => (
            <div key={m.userId} style={{ marginLeft: i === 0 ? 0 : -9 }}>
              <Avatar
                initial={(m.nickname || m.username).charAt(0)}
                color={PROFILE_COLOR_TO_AVATAR[m.profileColor]}
                size={28}
              />
            </div>
          ))}
          {group.memberCount > 4 && (
            <span
              className="flex items-center justify-center rounded-full font-bold select-none"
              style={{
                marginLeft: -9,
                width: 28,
                height: 28,
                background: '#E6ECF4',
                color: 'var(--color-text-muted)',
                fontSize: 11,
              }}
            >
              +{group.memberCount - 4}
            </span>
          )}
        </div>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-subtle)' }}>
          {total}개 중 {done}개 완료
        </span>
      </div>
    </Card>
  )
}

function SkeletonCard() {
  return (
    <Card style={{ borderRadius: 22, padding: 18 }}>
      <div className="animate-pulse">
        <div style={{ width: '50%', height: 16, borderRadius: 6, background: '#E6ECF4', marginBottom: 14 }} />
        <div style={{ width: '100%', height: 9, borderRadius: 999, background: '#EDF1F7', marginBottom: 14 }} />
        <div style={{ width: '40%', height: 12, borderRadius: 6, background: '#EDF1F7' }} />
      </div>
    </Card>
  )
}

export default function Groups() {
  const navigate = useNavigate()
  const { data, isLoading, isError, refetch } = useGroups()

  return (
    <div className="min-h-screen">
      <StatusBar />

      <header style={{ padding: '6px 22px 12px' }}>
        <h1 className="font-display" style={{ fontSize: 26, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-.5px' }}>
          그룹
        </h1>
        <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-subtle)', marginTop: 4 }}>
          함께한 진행률을 한눈에 보세요
        </p>
      </header>

      <div className="flex flex-col" style={{ gap: 12, padding: '0 22px 24px' }}>
        {isLoading && (
          <>
            <SkeletonCard />
            <SkeletonCard />
            <SkeletonCard />
          </>
        )}

        {isError && (
          <Card style={{ borderRadius: 22, padding: 22, textAlign: 'center' }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text)', marginBottom: 14 }}>
              그룹을 불러오지 못했어요
            </p>
            <Button variant="secondary" style={{ height: 48 }} onClick={() => refetch()}>
              다시 시도
            </Button>
          </Card>
        )}

        {!isLoading && !isError && data && data.length === 0 && (
          <div className="flex flex-col items-center text-center" style={{ padding: '40px 16px' }}>
            <div
              className="flex items-center justify-center"
              style={{ width: 88, height: 88, borderRadius: 28, background: '#EAF2FE', marginBottom: 22 }}
            >
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#1366CE" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
                <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
              </svg>
            </div>
            <h2 style={{ fontSize: 19, fontWeight: 800, color: 'var(--color-text)', marginBottom: 8 }}>
              첫 그룹을 만들어 함께 시작해보세요
            </h2>
            <p style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text-subtle)', marginBottom: 26, lineHeight: 1.5 }}>
              그룹을 만들면 초대 링크로 친구를 부르고
              <br />
              할 일을 함께 완성할 수 있어요
            </p>
            <Button style={{ maxWidth: 220 }} onClick={() => navigate('/groups/new')}>
              그룹 만들기
            </Button>
          </div>
        )}

        {!isLoading && !isError && data && data.length > 0 &&
          data.map((g) => (
            <GroupCard key={g.id} group={g} onClick={() => navigate(`/groups/${g.id}`)} />
          ))}
      </div>

      <FAB aria-label="그룹 만들기" onClick={() => navigate('/groups/new')} />
    </div>
  )
}
