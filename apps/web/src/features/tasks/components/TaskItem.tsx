import { Avatar } from '../../../shared/ui'
import { PROFILE_COLOR_TO_AVATAR } from '../../auth/types'
import type { Task } from '../types'

/** Minimal live-session shape needed to render the in_progress state. */
export type TaskLiveSession = {
  taskId: string
  nickname: string
  status: 'active' | 'paused'
}

type TaskItemProps = {
  task: Task
  /** Toggle complete/reopen (optimistic). */
  onToggle: (task: Task) => void
  /** Claim an unassigned task ("내가 할게요"). */
  onAssignSelf: (task: Task) => void
  /** Whether an assign-self request is currently in flight for this task. */
  assigning?: boolean
  /** Optional tap handler for the task body (opens detail). */
  onOpen?: (task: Task) => void
  /** Start a live session on this task (▶ "지금 함"). */
  onStartLive?: (task: Task) => void
  /** Open the live screen for an already-running session (참여/이어가기). */
  onOpenLive?: (task: Task) => void
  /** The active live session for this task, if any (for the real nickname). */
  liveSession?: TaskLiveSession
}

const PRIORITY_LABEL: Record<Task['priority'], string> = {
  low: '낮은 우선순위',
  medium: '',
  high: '높은 우선순위',
}

/** Builds the small grey subtitle (due hint + priority). */
function subtitleFor(task: Task): string | null {
  const parts: string[] = []
  if (task.dueDate) parts.push(formatDueHint(task.dueDate))
  if (task.priority === 'high' || task.priority === 'low') parts.push(PRIORITY_LABEL[task.priority])
  return parts.length ? parts.join(' · ') : null
}

/** Friendly relative-day label for a due date (오늘/내일/요일/날짜). */
function formatDueHint(iso: string): string {
  const due = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(due.getTime())) return iso
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diffDays = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (diffDays === 0) return '오늘'
  if (diffDays === 1) return '내일'
  if (diffDays === -1) return '어제'
  if (diffDays < -1) return `${Math.abs(diffDays)}일 지남`
  if (diffDays > 1 && diffDays < 7) {
    return ['일', '월', '화', '수', '목', '금', '토'][due.getDay()]
  }
  return `${due.getMonth() + 1}월 ${due.getDate()}일`
}

export function TaskItem({
  task,
  onToggle,
  onAssignSelf,
  assigning,
  onOpen,
  onStartLive,
  onOpenLive,
  liveSession,
}: TaskItemProps) {
  const isDone = task.status === 'done'
  const isLive = task.status === 'in_progress' || Boolean(liveSession)
  const assignee = task.assignees[0]
  const subtitle = subtitleFor(task)
  // Prefer the real session nickname over the assignee for the live subtitle.
  const liveNickname = liveSession?.nickname ?? assignee?.nickname

  // In-progress card: teal tint + border, with a live subtitle.
  const cardStyle: React.CSSProperties = isLive
    ? {
        borderRadius: 18,
        padding: '14px 15px',
        background: '#F6FCFB',
        border: '1.5px solid #C6F1EA',
        boxShadow: '0 8px 20px rgba(43,196,176,.14)',
      }
    : {
        borderRadius: 18,
        padding: '14px 15px',
        background: 'var(--color-card)',
        boxShadow: '0 5px 16px rgba(17,40,86,.05)',
      }

  const liveSubtitle = isLive
    ? `${liveNickname ? `${liveNickname}님이 ` : ''}하는 중 · ${liveSession?.status === 'paused' ? '일시정지' : '라이브'}`
    : null

  return (
    <div className="flex items-center" style={{ gap: 13, ...cardStyle }}>
      {/* Checkbox — real button, toggles complete/reopen */}
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-pressed={isDone}
        aria-label={isDone ? `${task.title} 완료 취소` : `${task.title} 완료`}
        className="relative flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        style={{
          flex: 'none',
          width: 24,
          height: 24,
          borderRadius: 9,
          background: isDone ? '#46D38A' : 'transparent',
          border: isDone
            ? 'none'
            : `2.5px solid ${isLive ? '#2BC4B0' : '#DDE3EC'}`,
        }}
      >
        {isDone && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12.5l4.5 4.5L19 6.5" />
          </svg>
        )}
        {isLive && (
          <span
            aria-hidden="true"
            className="absolute"
            style={{
              inset: -2.5,
              borderRadius: 9,
              border: '2px solid #2BC4B0',
              animation: 'tdlPulse 2s infinite',
            }}
          />
        )}
      </button>

      {/* Title + subtitle */}
      <button
        type="button"
        onClick={() => onOpen?.(task)}
        disabled={!onOpen}
        className="flex-1 min-w-0 text-left focus:outline-none disabled:cursor-default"
      >
        <div
          className="truncate"
          style={{
            fontSize: 14,
            fontWeight: isDone ? 700 : isLive ? 800 : 700,
            color: isDone ? '#AEB9CC' : 'var(--color-text)',
            textDecoration: isDone ? 'line-through' : 'none',
          }}
        >
          {task.title}
        </div>
        {liveSubtitle ? (
          <div style={{ fontSize: 11, fontWeight: 700, color: '#159B89', marginTop: 1 }}>
            {liveSubtitle}
          </div>
        ) : subtitle ? (
          <div style={{ fontSize: 11, fontWeight: 600, color: 'var(--color-text-subtle)', marginTop: 1 }}>
            {subtitle}
          </div>
        ) : null}
      </button>

      {/* Trailing affordances */}
      {isLive && onOpenLive ? (
        // Live: tap to join / continue the session.
        <button
          type="button"
          onClick={() => onOpenLive(task)}
          aria-label={`${task.title} 라이브 참여`}
          className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          style={{
            flex: 'none',
            gap: 4,
            padding: '8px 13px',
            borderRadius: 13,
            background: '#E2F8F4',
            color: '#159B89',
            fontSize: 11.5,
            fontWeight: 800,
          }}
        >
          참여
        </button>
      ) : assignee ? (
        <div className="flex items-center" style={{ flex: 'none', gap: 8 }}>
          {/* ▶ Start live (only when not done and a handler is wired). */}
          {!isDone && onStartLive && (
            <button
              type="button"
              onClick={() => onStartLive(task)}
              aria-label={`${task.title} 지금 시작`}
              className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              style={{ width: 30, height: 30, borderRadius: '50%', background: '#EAF2FE', flex: 'none' }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="#1366CE" stroke="none">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
          )}
          <div aria-label={`담당 ${assignee.nickname}`}>
            <Avatar
              initial={(assignee.nickname || assignee.username).charAt(0)}
              color={PROFILE_COLOR_TO_AVATAR[assignee.profileColor]}
              size={26}
            />
          </div>
        </div>
      ) : !isDone ? (
        <button
          type="button"
          onClick={() => onAssignSelf(task)}
          disabled={assigning}
          className="flex items-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60"
          style={{
            flex: 'none',
            gap: 4,
            padding: '8px 13px',
            borderRadius: 13,
            background: '#1366CE',
            color: '#fff',
            fontSize: 11.5,
            fontWeight: 800,
          }}
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="#fff" stroke="none">
            <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
          </svg>
          {assigning ? '담당 중…' : '내가 할게요'}
        </button>
      ) : null}
    </div>
  )
}
