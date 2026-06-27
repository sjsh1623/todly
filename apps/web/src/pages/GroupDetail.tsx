import { useEffect, useState } from 'react'
import { useLocation, useNavigate, useParams } from 'react-router-dom'
import { Avatar, Card, FAB, ProgressBar, useToast } from '../shared/ui'
import {
  getGroupErrorMessage,
  useCreateInvite,
  useDeleteGroup,
  useGroup,
  useLeaveGroup,
} from '../features/groups'
import { PROFILE_COLOR_TO_AVATAR } from '../features/auth/types'
import { useAuthStore } from '../features/auth/store'
import {
  TaskItem,
  getTaskErrorMessage,
  useAssignSelf,
  useGroupTasks,
  useToggleComplete,
} from '../features/tasks'
import type { Section, Task } from '../features/tasks'
import {
  LiveBanner,
  useGroupOnlineCount,
  useGroupRealtime,
  useLiveStore,
  useStartLive,
  selectSessionForTask,
} from '../features/live'
import type { LiveSession } from '../features/live'
import { useCreateRoom } from '../features/rooms'

/** Cycle of mini-bar fill colors used in the overall-progress card. */
const MINI_BAR_COLORS = ['#34D9C4', '#46D38A', '#3B97F0', '#6B5BD0', '#FF9D52']

const HEADER_GRADIENT = 'linear-gradient(160deg,#1257C4 0%,#0E4FA8 60%,#0B3E86 100%)'

function inviteUrl(code: string) {
  return `${window.location.origin}/invite/${code}`
}

export default function GroupDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const location = useLocation()
  const locState = location.state as { justCreated?: boolean; inviteToast?: string } | null
  const justCreated = locState?.justCreated ?? false

  const { data: group, isLoading, isError } = useGroup(id)
  const { data: tasks, isLoading: tasksLoading } = useGroupTasks(id)
  const createInvite = useCreateInvite(id ?? '')
  const deleteGroup = useDeleteGroup()
  const leaveGroup = useLeaveGroup()
  const toggleComplete = useToggleComplete()
  const assignSelf = useAssignSelf()
  const startLive = useStartLive()
  const createRoom = useCreateRoom()

  /** Opens (or joins) the live room for a task, then navigates to it. */
  const openRoom = (taskId: string) => {
    createRoom.mutate(taskId, {
      onSuccess: (room) => navigate(`/rooms/${room.id}`),
      onError: () => navigate(`/live/${taskId}`), // fall back to solo live view
    })
  }
  const currentUserId = useAuthStore((s) => s.user?.id)

  // Keep this group's caches live (the global provider also subscribes; the
  // ref-counted STOMP subscribe makes this a cheap no-op duplicate).
  useGroupRealtime(id)
  const liveOnlineCount = useGroupOnlineCount(id)
  const sessions = useLiveStore((s) => s.sessions)
  // Active sessions belonging to this group, newest banner first.
  const groupSessions = Object.values(sessions).filter((s) => s.groupId === id)
  const bannerSession = groupSessions.find((s) => s.status === 'active') ?? groupSessions[0]

  const [menuOpen, setMenuOpen] = useState(false)
  const [inviteLink, setInviteLink] = useState<string | null>(null)
  const toast = useToast()

  const isOwner = group?.role === 'owner'
  const canInvite = group?.role === 'owner' || group?.role === 'admin'

  const showToast = (msg: string) => toast.info(msg)

  // Surface a toast handed back from the invite-friends screen, then clear it.
  useEffect(() => {
    if (locState?.inviteToast) {
      showToast(locState.inviteToast)
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locState?.inviteToast])

  // After group creation, auto-generate an invite link to surface to the owner.
  useEffect(() => {
    if (justCreated && id && !inviteLink && !createInvite.isPending) {
      createInvite.mutate(undefined, {
        onSuccess: (inv) => setInviteLink(inviteUrl(inv.code)),
      })
      // Clear the state so a reload doesn't re-trigger.
      navigate(location.pathname, { replace: true, state: {} })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [justCreated, id])

  const handleGenerateInvite = () => {
    createInvite.mutate(undefined, {
      onSuccess: (inv) => {
        setInviteLink(inviteUrl(inv.code))
        toast.success('초대 링크를 만들었어요')
      },
      onError: (err) => toast.error(getGroupErrorMessage(err)),
    })
  }

  const handleCopy = async (link: string) => {
    try {
      await navigator.clipboard.writeText(link)
      toast.success('링크를 복사했어요')
    } catch {
      toast.error('복사에 실패했어요')
    }
  }

  const handleDelete = () => {
    if (!id) return
    if (!window.confirm('이 그룹을 삭제할까요? 되돌릴 수 없어요.')) return
    deleteGroup.mutate(id, {
      onSuccess: () => navigate('/groups', { replace: true }),
      onError: (err) => toast.error(getGroupErrorMessage(err)),
    })
  }

  const handleLeave = () => {
    if (!id) return
    if (!window.confirm('이 그룹에서 나갈까요?')) return
    leaveGroup.mutate(id, {
      onSuccess: () => navigate('/groups', { replace: true }),
      onError: (err) => toast.error(getGroupErrorMessage(err)),
    })
  }

  const handleToggle = (task: Task) => {
    if (!id) return
    toggleComplete.mutate(
      { taskId: task.id, groupId: id, currentStatus: task.status },
      { onError: (err) => toast.error(getTaskErrorMessage(err)) },
    )
  }

  const handleAssignSelf = (task: Task) => {
    if (!id || !currentUserId) return
    assignSelf.mutate(
      { taskId: task.id, groupId: id, userId: currentUserId },
      {
        onSuccess: () => toast.success("내가 담당하기로 했어요"),
        onError: (err) => toast.error(getTaskErrorMessage(err)),
      },
    )
  }

  const handleStartLive = (task: Task) => {
    if (!id) return
    startLive.mutate(
      { taskId: task.id, groupId: id },
      {
        // After live starts, open a shared room so others can join in.
        onSuccess: () => openRoom(task.id),
        onError: (err) => toast.error(getTaskErrorMessage(err)),
      },
    )
  }

  const handleJoinLive = (session: LiveSession) => {
    openRoom(session.taskId)
  }

  const goToAddTask = (sectionId?: string) => {
    if (!id) return
    const params = new URLSearchParams({ group: id })
    if (sectionId) params.set('section', sectionId)
    navigate(`/tasks/new?${params.toString()}`)
  }

  if (isLoading) {
    return (
      <div className="min-h-screen" style={{ background: 'var(--color-bg-2)' }} aria-busy="true">
        <div style={{ height: 236, background: HEADER_GRADIENT }} />
      </div>
    )
  }

  if (isError || !group) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center" style={{ background: 'var(--color-bg-2)', padding: 24 }}>
        <p style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-text)', marginBottom: 16 }}>
          그룹을 불러오지 못했어요
        </p>
        <button
          onClick={() => navigate('/groups')}
          style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-primary-strong)' }}
        >
          그룹 목록으로
        </button>
      </div>
    )
  }

  // Prefer live task progress once loaded; fall back to the group summary.
  const { percent, done, total } = tasks?.progress ?? group.progress
  const sections = tasks?.sections ?? []
  const unsectioned = tasks?.unsectioned ?? []
  const hasAnyTask =
    sections.some((s) => s.tasks.length > 0) || unsectioned.length > 0

  return (
    <div className="relative min-h-screen" style={{ background: 'var(--color-bg-2)' }}>
      {/* Gradient header backdrop */}
      <div className="absolute left-0 right-0 top-0" style={{ height: 236, background: HEADER_GRADIENT }} />

      {/* Top safe-area spacer — the device draws the real status bar. */}
      <div aria-hidden="true" style={{ height: 'env(safe-area-inset-top, 0px)' }} />

      <div className="relative" style={{ zIndex: 10, padding: '6px 22px 24px' }}>
        {/* Back + kebab */}
        <div className="flex items-center justify-between" style={{ marginBottom: 18 }}>
          <button
            type="button"
            onClick={() => navigate('/groups')}
            aria-label="뒤로"
            className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
            style={{ width: 38, height: 38, borderRadius: 13, background: 'rgba(255,255,255,.16)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label="더보기"
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
              style={{ width: 38, height: 38, borderRadius: 13, background: 'rgba(255,255,255,.16)' }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#fff">
                <circle cx="5" cy="12" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="19" cy="12" r="2" />
              </svg>
            </button>

            {menuOpen && (
              <>
                <div className="fixed inset-0" style={{ zIndex: 30 }} onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div
                  role="menu"
                  className="absolute right-0"
                  style={{ top: 44, zIndex: 40, background: '#fff', borderRadius: 14, minWidth: 160, padding: 6, boxShadow: '0 12px 30px rgba(17,40,86,.18)' }}
                >
                  {isOwner ? (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        handleDelete()
                      }}
                      disabled={deleteGroup.isPending}
                      className="w-full text-left"
                      style={{ padding: '11px 12px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: 'var(--color-due)' }}
                    >
                      그룹 삭제
                    </button>
                  ) : (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false)
                        handleLeave()
                      }}
                      disabled={leaveGroup.isPending}
                      className="w-full text-left"
                      style={{ padding: '11px 12px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: 'var(--color-due)' }}
                    >
                      그룹 나가기
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* Group name + members */}
        <div style={{ color: '#fff', marginBottom: 18 }}>
          <h1 className="font-display" style={{ fontSize: 27, fontWeight: 800, letterSpacing: '-.6px' }}>
            {group.name}
          </h1>
          <div className="flex items-center" style={{ gap: 10, marginTop: 12 }}>
            <div className="flex">
              {group.members.slice(0, 4).map((m, i) => (
                <div key={m.userId} style={{ marginLeft: i === 0 ? 0 : -9, borderRadius: '50%', border: '2px solid #1257C4' }}>
                  <Avatar
                    initial={(m.nickname || m.username).charAt(0)}
                    color={PROFILE_COLOR_TO_AVATAR[m.profileColor]}
                    size={30}
                  />
                </div>
              ))}
            </div>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.85)' }}>
              멤버 {group.memberCount}명 · {liveOnlineCount ?? group.onlineCount}명 접속 중
            </span>
          </div>
        </div>

        {/* Live banner — someone is actively working in this group */}
        {bannerSession && (
          <LiveBanner session={bannerSession} onJoin={handleJoinLive} />
        )}

        {/* Invite link card (owner/admin) */}
        {canInvite && (
          <Card style={{ borderRadius: 18, padding: 16, marginBottom: 16 }}>
            {inviteLink ? (
              <div>
                <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text-subtle)', marginBottom: 8 }}>
                  초대 링크
                </div>
                <div className="flex items-center" style={{ gap: 8 }}>
                  <input
                    readOnly
                    value={inviteLink}
                    aria-label="초대 링크"
                    onFocus={(e) => e.currentTarget.select()}
                    className="flex-1 min-w-0"
                    style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)', background: '#F2F6FC', border: '1px solid #E6ECF4', borderRadius: 12, padding: '11px 12px' }}
                  />
                  <button
                    type="button"
                    onClick={() => handleCopy(inviteLink)}
                    style={{ flex: 'none', padding: '11px 16px', borderRadius: 12, background: '#1366CE', color: '#fff', fontSize: 13, fontWeight: 800 }}
                  >
                    복사
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={handleGenerateInvite}
                disabled={createInvite.isPending}
                className="w-full flex items-center justify-center"
                style={{ gap: 8, color: 'var(--color-primary-strong)', fontSize: 14, fontWeight: 800 }}
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14M5 12h14" />
                </svg>
                {createInvite.isPending ? '링크 만드는 중…' : '초대 링크 만들기'}
              </button>
            )}

            {/* Invite friends directly (in addition to the share link). */}
            <button
              type="button"
              onClick={() => navigate(`/groups/${id}/invite`)}
              className="w-full flex items-center justify-center"
              style={{ gap: 8, marginTop: 12, paddingTop: 12, borderTop: '1px solid #F0F3F8', color: 'var(--color-primary-strong)', fontSize: 14, fontWeight: 800 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                <circle cx="9" cy="8" r="3.5" />
                <path d="M3 20c0-3.3 2.7-5 6-5s6 1.7 6 5" />
                <path d="M18 8v6M21 11h-6" />
              </svg>
              친구 초대
            </button>
          </Card>
        )}

        {/* Overall progress card with per-section mini-bars */}
        <Card style={{ borderRadius: 24, padding: 18, marginBottom: 22 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: sections.length ? 16 : 0 }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-subtle)' }}>전체 진행률</div>
              <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--color-text)' }}>{percent}% 완료</div>
            </div>
            <div style={{ fontSize: 12, fontWeight: 700, color: '#1366CE', background: '#EAF2FE', padding: '7px 12px', borderRadius: 12 }}>
              {done} / {total}
            </div>
          </div>
          {sections.length > 0 ? (
            <div className="flex" style={{ gap: 8 }}>
              {sections.map((section, i) => {
                const sPercent =
                  section.progress.total === 0
                    ? 0
                    : Math.round((section.progress.done / section.progress.total) * 100)
                return (
                  <div key={section.id} style={{ flex: 1, minWidth: 0 }}>
                    <div
                      className="truncate"
                      style={{ fontSize: 11, fontWeight: 700, color: '#7C8AA0', marginBottom: 6 }}
                    >
                      {section.title}
                    </div>
                    <div style={{ height: 6, borderRadius: 4, background: '#EDF1F7', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${sPercent}%`,
                          height: '100%',
                          borderRadius: 4,
                          background: MINI_BAR_COLORS[i % MINI_BAR_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <ProgressBar value={percent} />
          )}
        </Card>

        {/* Sections + task lists */}
        {tasksLoading && !tasks ? (
          <div className="flex flex-col" style={{ gap: 11 }} aria-busy="true">
            {[0, 1, 2].map((i) => (
              <div key={i} style={{ height: 56, borderRadius: 18, background: '#fff', opacity: 0.6 }} />
            ))}
          </div>
        ) : hasAnyTask ? (
          <div className="flex flex-col" style={{ gap: 22 }}>
            {sections.map((section) => (
              <TaskSection
                key={section.id}
                section={section}
                onToggle={handleToggle}
                onAssignSelf={handleAssignSelf}
                assigning={assignSelf.isPending}
                onAddTask={() => goToAddTask(section.id)}
                onStartLive={handleStartLive}
                onOpenLive={(t) => navigate(`/live/${t.id}`)}
                onOpen={(t) => navigate(`/tasks/${t.id}`)}
                sessions={sessions}
              />
            ))}
            {unsectioned.length > 0 && (
              <div>
                <div className="flex items-center justify-between" style={{ margin: '0 2px 12px' }}>
                  <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>기타</div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-subtle)' }}>
                    {unsectioned.length}개
                  </div>
                </div>
                <div className="flex flex-col" style={{ gap: 11 }}>
                  {unsectioned.map((task) => {
                    const s = selectSessionForTask(sessions, task.id)
                    return (
                      <TaskItem
                        key={task.id}
                        task={task}
                        onToggle={handleToggle}
                        onAssignSelf={handleAssignSelf}
                        assigning={assignSelf.isPending}
                        onStartLive={handleStartLive}
                        onOpenLive={(t) => navigate(`/live/${t.id}`)}
                        onOpen={(t) => navigate(`/tasks/${t.id}`)}
                        liveSession={s ? { taskId: s.taskId, nickname: s.nickname, status: s.status } : undefined}
                      />
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{ border: '1.5px dashed #D6DEEA', borderRadius: 20, padding: '40px 20px' }}
          >
            <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#C2CBD8" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12 }}>
              <path d="M9 11l3 3L22 4" />
              <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
            </svg>
            <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-muted)', marginBottom: 16 }}>
              아직 투두가 없어요
            </p>
            <button
              type="button"
              onClick={() => goToAddTask()}
              style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-primary-strong)' }}
            >
              + 첫 투두 추가하기
            </button>
          </div>
        )}
      </div>

      {/* FAB → add task in this group */}
      <FAB onClick={() => goToAddTask()} aria-label="투두 추가" style={{ bottom: 40 }} />
    </div>
  )
}

type TaskSectionProps = {
  section: Section
  onToggle: (task: Task) => void
  onAssignSelf: (task: Task) => void
  assigning: boolean
  onAddTask: () => void
  onStartLive: (task: Task) => void
  onOpenLive: (task: Task) => void
  onOpen: (task: Task) => void
  sessions: Record<string, LiveSession>
}

function TaskSection({
  section,
  onToggle,
  onAssignSelf,
  assigning,
  onAddTask,
  onStartLive,
  onOpenLive,
  onOpen,
  sessions,
}: TaskSectionProps) {
  return (
    <div>
      <div className="flex items-center justify-between" style={{ margin: '0 2px 12px' }}>
        <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>{section.title}</h2>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-text-subtle)' }}>
          {section.progress.total}개 중 {section.progress.done}개
        </div>
      </div>
      <div className="flex flex-col" style={{ gap: 11 }}>
        {section.tasks.map((task) => {
          const s = selectSessionForTask(sessions, task.id)
          return (
            <TaskItem
              key={task.id}
              task={task}
              onToggle={onToggle}
              onAssignSelf={onAssignSelf}
              assigning={assigning}
              onStartLive={onStartLive}
              onOpenLive={onOpenLive}
              onOpen={onOpen}
              liveSession={s ? { taskId: s.taskId, nickname: s.nickname, status: s.status } : undefined}
            />
          )
        })}
        <button
          type="button"
          onClick={onAddTask}
          className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{
            gap: 6,
            height: 44,
            borderRadius: 14,
            border: '1.5px dashed #D6DEEA',
            color: 'var(--color-text-subtle)',
            fontSize: 13,
            fontWeight: 700,
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          투두
        </button>
      </div>
    </div>
  )
}
