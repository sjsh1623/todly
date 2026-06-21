import { useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import i18n from '../shared/i18n/i18n'
import { Avatar, Card, Heatmap, PushHeader } from '../shared/ui'
import { useAuthStore } from '../features/auth'
import { PROFILE_COLOR_TO_AVATAR } from '../features/auth/types'
import { relativeTime } from '../shared/lib/relativeTime'
import {
  useTask,
  useToggleSubtask,
  useAddSubtask,
  useRemoveSubtask,
  useAddComment,
  useUploadTaskPhoto,
  useSetTaskStatus,
  useDeleteTask,
  useAssignSelfDetail,
} from '../features/tasks'
import type { Task } from '../features/tasks'

const PRIORITY_LABEL_KEY: Record<Task['priority'], string> = {
  low: 'taskDetail.priorityLow',
  medium: 'taskDetail.priorityMedium',
  high: 'taskDetail.priorityHigh',
}

/** Friendly relative-day label for a due date (오늘/내일/요일/날짜). */
function formatDueHint(iso: string): string {
  const due = new Date(`${iso}T00:00:00`)
  if (Number.isNaN(due.getTime())) return iso
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const diff = Math.round((due.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return i18n.t('taskDetail.dueToday')
  if (diff === 1) return i18n.t('taskDetail.dueTomorrow')
  if (diff === -1) return i18n.t('taskDetail.dueYesterday')
  if (diff < -1) return i18n.t('taskDetail.dueDaysOverdue', { n: Math.abs(diff) })
  if (diff > 1 && diff < 7) {
    const weekdayKeys = [
      'taskDetail.dueWeekdaySun',
      'taskDetail.dueWeekdayMon',
      'taskDetail.dueWeekdayTue',
      'taskDetail.dueWeekdayWed',
      'taskDetail.dueWeekdayThu',
      'taskDetail.dueWeekdayFri',
      'taskDetail.dueWeekdaySat',
    ]
    return i18n.t('taskDetail.dueWeekday', { day: i18n.t(weekdayKeys[due.getDay()]) })
  }
  return i18n.t('taskDetail.dueMonthDay', { month: due.getMonth() + 1, day: due.getDate() })
}

export default function TaskDetail() {
  const { t } = useTranslation()
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const user = useAuthStore((s) => s.user)

  const taskQuery = useTask(id)
  const task = taskQuery.data

  const toggleSubtask = useToggleSubtask(id ?? '')
  const addSubtask = useAddSubtask(id ?? '')
  const removeSubtask = useRemoveSubtask(id ?? '')
  const addComment = useAddComment(id ?? '')
  const uploadPhoto = useUploadTaskPhoto(id ?? '')
  const setStatus = useSetTaskStatus(id ?? '')
  const deleteTask = useDeleteTask()
  const assignSelf = useAssignSelfDetail(id ?? '')

  const [menuOpen, setMenuOpen] = useState(false)
  const [newSubtask, setNewSubtask] = useState('')
  const [comment, setComment] = useState('')
  const [viewPhoto, setViewPhoto] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  if (taskQuery.isLoading) {
    return (
      <div>
        <PushHeader title={t('taskDetail.header')} onBack={() => navigate(-1)} />
        <div style={{ padding: 40, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#9AA7BC' }}>
          {t('taskDetail.loading')}
        </div>
      </div>
    )
  }

  if (!task) {
    return (
      <div>
        <PushHeader title={t('taskDetail.header')} onBack={() => navigate(-1)} />
        <div style={{ padding: 40, textAlign: 'center', fontSize: 13, fontWeight: 600, color: '#9AA7BC' }}>
          {t('taskDetail.notFound')}
        </div>
      </div>
    )
  }

  const isDone = task.status === 'done'
  const assignee = task.assignees[0]
  const isMine = Boolean(assignee && user && assignee.userId === user.id)
  const subtasks = [...task.subtasks].sort((a, b) => a.position - b.position)
  const doneCount = subtasks.filter((s) => s.isDone).length
  const breadcrumb = [task.groupName, task.sectionTitle].filter(Boolean).join(' · ')
  const weeks = task.consistency?.weeks ?? 0

  const handleAddSubtask = () => {
    const t = newSubtask.trim()
    if (!t) return
    addSubtask.mutate(t)
    setNewSubtask('')
  }

  const handleAddComment = () => {
    const b = comment.trim()
    if (!b) return
    addComment.mutate(b)
    setComment('')
  }

  const handlePickPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) uploadPhoto.mutate(file)
    e.target.value = ''
  }

  const handleComplete = () => {
    setStatus.mutate(
      { complete: !isDone, groupId: task.groupId },
      { onSuccess: () => { if (!isDone) navigate(-1) } },
    )
  }

  const handleDelete = () => {
    if (!window.confirm(t('taskDetail.deleteConfirm'))) return
    deleteTask.mutate(
      { taskId: task.id, groupId: task.groupId },
      { onSuccess: () => navigate(-1) },
    )
  }

  return (
    <div style={{ paddingBottom: 100 }}>
      <PushHeader
        title={t('taskDetail.header')}
        onBack={() => navigate(-1)}
        trailing={
          <div className="relative">
            <button
              type="button"
              onClick={() => setMenuOpen((v) => !v)}
              aria-label={t('taskDetail.more')}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
              style={{ width: 38, height: 38 }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="#C2CBD8">
                <circle cx="12" cy="5" r="2" />
                <circle cx="12" cy="12" r="2" />
                <circle cx="12" cy="19" r="2" />
              </svg>
            </button>
            {menuOpen && (
              <>
                <div className="fixed inset-0" style={{ zIndex: 30 }} onClick={() => setMenuOpen(false)} aria-hidden="true" />
                <div
                  role="menu"
                  className="absolute right-0"
                  style={{ top: 44, zIndex: 40, background: '#fff', borderRadius: 14, minWidth: 150, padding: 6, boxShadow: '0 12px 30px rgba(17,40,86,.18)' }}
                >
                  <button
                    role="menuitem"
                    onClick={() => { setMenuOpen(false); handleDelete() }}
                    disabled={deleteTask.isPending}
                    className="w-full text-left"
                    style={{ padding: '11px 12px', borderRadius: 10, fontSize: 14, fontWeight: 700, color: '#FF6B6B' }}
                  >
                    {t('taskDetail.deleteTask')}
                  </button>
                </div>
              </>
            )}
          </div>
        }
      />

      <div style={{ padding: '8px 22px 24px' }}>
        {/* Breadcrumb chip */}
        {breadcrumb && (
          <div
            className="inline-flex items-center"
            style={{ gap: 6, background: '#EAF2FE', padding: '6px 12px', borderRadius: 11, marginBottom: 14 }}
          >
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#1366CE" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <rect x="4" y="4" width="6.4" height="6.4" rx="2" />
              <rect x="13.6" y="4" width="6.4" height="6.4" rx="2" />
              <rect x="4" y="13.6" width="6.4" height="6.4" rx="2" />
              <rect x="13.6" y="13.6" width="6.4" height="6.4" rx="2" />
            </svg>
            <span style={{ fontSize: 11.5, fontWeight: 800, color: '#1366CE' }}>{breadcrumb}</span>
          </div>
        )}

        {/* Title */}
        <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-.4px', marginBottom: 14 }}>
          {task.title}
        </h1>

        {/* Meta chips */}
        <div className="flex" style={{ gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {task.dueDate && (
            <div className="flex items-center" style={{ gap: 6, background: '#fff', padding: '8px 13px', borderRadius: 12, boxShadow: '0 4px 12px rgba(20,50,90,.05)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#7C8AA0" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="5" width="18" height="16" rx="3" />
                <path d="M3 9h18M8 3v4M16 3v4" />
              </svg>
              <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)' }}>{formatDueHint(task.dueDate)}</span>
            </div>
          )}
          <div className="flex items-center" style={{ gap: 6, background: '#fff', padding: '8px 13px', borderRadius: 12, boxShadow: '0 4px 12px rgba(20,50,90,.05)' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FF9D52" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 21V4M5 4h11l-2 4 2 4H5" />
            </svg>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-text)' }}>{t(PRIORITY_LABEL_KEY[task.priority])}</span>
          </div>
        </div>

        {/* Assignee / 내가 할게요 */}
        {assignee ? (
          <div
            className="flex items-center"
            style={{ gap: 11, background: '#fff', borderRadius: 16, padding: '12px 15px', boxShadow: '0 6px 20px rgba(17,40,86,.06)', marginBottom: 22 }}
          >
            <Avatar
              initial={(assignee.nickname || assignee.username).charAt(0)}
              color={PROFILE_COLOR_TO_AVATAR[assignee.profileColor]}
              size={34}
            />
            <div style={{ flex: 1, fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>
              {assignee.nickname}
              {isMine && <span style={{ fontSize: 12, fontWeight: 700, color: '#9AA7BC' }}> · {t('taskDetail.assignedToMe')}</span>}
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => user && assignSelf.mutate({ userId: user.id, groupId: task.groupId })}
            disabled={assignSelf.isPending}
            className="w-full flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60"
            style={{ height: 54, borderRadius: 16, background: '#1366CE', gap: 8, color: '#fff', fontSize: 15, fontWeight: 800, marginBottom: 22 }}
          >
            <svg width="17" height="17" viewBox="0 0 24 24" fill="#fff" stroke="none" aria-hidden="true">
              <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
            </svg>
            {assignSelf.isPending ? t('taskDetail.assigning') : t('taskDetail.claim')}
          </button>
        )}

        {/* Checklist */}
        <Card style={{ borderRadius: 20, padding: 16, marginBottom: 14 }}>
          <div className="flex items-center justify-between" style={{ marginBottom: 12 }}>
            <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>{t('taskDetail.checklist')}</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#9AA7BC' }}>
              {doneCount}/{subtasks.length}
            </span>
          </div>
          {subtasks.map((st) => (
            <div key={st.id} className="flex items-center" style={{ gap: 11, padding: '7px 0' }}>
              <button
                type="button"
                onClick={() => toggleSubtask.mutate({ id: st.id, isDone: !st.isDone })}
                role="checkbox"
                aria-checked={st.isDone}
                aria-label={st.title}
                className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                style={{
                  flex: 'none',
                  width: 22,
                  height: 22,
                  borderRadius: 7,
                  background: st.isDone ? '#46D38A' : 'transparent',
                  border: st.isDone ? 'none' : '2.5px solid #DDE3EC',
                }}
              >
                {st.isDone && (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12.5l4.5 4.5L19 6.5" />
                  </svg>
                )}
              </button>
              <span
                style={{
                  flex: 1,
                  fontSize: 13.5,
                  fontWeight: st.isDone ? 600 : 700,
                  color: st.isDone ? '#AEB9CC' : 'var(--color-text)',
                  textDecoration: st.isDone ? 'line-through' : 'none',
                }}
              >
                {st.title}
              </span>
              <button
                type="button"
                onClick={() => removeSubtask.mutate(st.id)}
                aria-label={t('taskDetail.deleteItem', { title: st.title })}
                className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                style={{ flex: 'none', width: 22, height: 22 }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#C2CBD8" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
          {/* Add row */}
          <div className="flex items-center" style={{ gap: 11, padding: '7px 0' }}>
            <span className="flex items-center justify-center" style={{ flex: 'none', width: 22, height: 22, borderRadius: 7, border: '2.5px dashed #DDE3EC' }} aria-hidden="true">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#C2CBD8" strokeWidth={2.6} strokeLinecap="round">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </span>
            <input
              type="text"
              value={newSubtask}
              onChange={(e) => setNewSubtask(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddSubtask() }}
              placeholder={t('taskDetail.addItemPlaceholder')}
              aria-label={t('taskDetail.addItemAria')}
              className="flex-1 bg-transparent focus:outline-none"
              style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--color-text)' }}
            />
            {newSubtask.trim() && (
              <button
                type="button"
                onClick={handleAddSubtask}
                disabled={addSubtask.isPending}
                style={{ fontSize: 12.5, fontWeight: 800, color: '#1366CE' }}
              >
                {t('taskDetail.add')}
              </button>
            )}
          </div>
        </Card>

        {/* Photos */}
        <Card style={{ borderRadius: 20, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', marginBottom: 12 }}>{t('taskDetail.photos')}</div>
          <div className="flex" style={{ gap: 9, flexWrap: 'wrap' }}>
            {(task.photos ?? []).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setViewPhoto(p.url)}
                aria-label={t('taskDetail.viewPhoto')}
                className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
                style={{ width: 64, height: 64, borderRadius: 14, overflow: 'hidden', flex: 'none', padding: 0, border: 'none' }}
              >
                <img src={p.thumbUrl || p.url} alt={t('taskDetail.photoAlt')} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              </button>
            ))}
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploadPhoto.isPending}
              aria-label={t('taskDetail.addPhoto')}
              className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60"
              style={{ width: 64, height: 64, borderRadius: 14, background: '#F4F7FB', border: '1.5px dashed #C9D3E0', flex: 'none' }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#AEB9CC" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M4 7h3l1.5-2h7L17 7h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1z" />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
            </button>
            <input ref={fileRef} type="file" accept="image/*" onChange={handlePickPhoto} className="hidden" aria-hidden="true" />
          </div>
        </Card>

        {/* 이 투두의 꾸준함 */}
        {weeks > 0 && (
          <Card style={{ borderRadius: 20, padding: 16, marginBottom: 14 }}>
            <div className="flex items-center justify-between" style={{ marginBottom: 13 }}>
              <span style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)' }}>{t('taskDetail.consistency')}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#1366CE' }}>{t('taskDetail.weeksRunning', { n: weeks })}</span>
            </div>
            {task.consistency?.heatmap && task.consistency.heatmap.length > 0 && (
              <Heatmap days={task.consistency.heatmap} weeks={14} radius={2.5} />
            )}
          </Card>
        )}

        {/* Comments */}
        <Card style={{ borderRadius: 20, padding: 16 }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-text)', marginBottom: 13 }}>{t('taskDetail.comments')}</div>
          {(task.comments ?? []).map((c) => (
            <div key={c.id} className="flex" style={{ gap: 9, marginBottom: 11 }}>
              <Avatar
                initial={c.author.nickname.charAt(0)}
                color={PROFILE_COLOR_TO_AVATAR[c.author.profileColor]}
                size={28}
              />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 700, color: '#9AA7BC', marginBottom: 3 }}>
                  {c.author.nickname} · {relativeTime(c.createdAt)}
                </div>
                <div style={{ background: '#F4F7FB', borderRadius: 12, padding: '9px 12px', fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}>
                  {c.body}
                </div>
              </div>
            </div>
          ))}
          {/* Composer */}
          <div className="flex items-center" style={{ gap: 9 }}>
            <span className="flex items-center justify-center" style={{ width: 28, height: 28, borderRadius: '50%', background: '#EDF1F7', flex: 'none' }} aria-hidden="true">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#AEB9CC" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
            </span>
            <input
              type="text"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAddComment() }}
              placeholder={t('taskDetail.commentPlaceholder')}
              aria-label={t('taskDetail.commentAria')}
              className="flex-1 bg-transparent focus:outline-none"
              style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-text)' }}
            />
            {comment.trim() && (
              <button
                type="button"
                onClick={handleAddComment}
                disabled={addComment.isPending}
                style={{ fontSize: 12.5, fontWeight: 800, color: '#1366CE' }}
              >
                {t('taskDetail.submitComment')}
              </button>
            )}
          </div>
        </Card>
      </div>

      {/* Bottom action bar */}
      <div
        style={{
          position: 'sticky',
          bottom: 0,
          padding: '14px 22px 26px',
          background: 'linear-gradient(180deg,rgba(242,246,252,0),#F2F6FC 32%)',
          display: 'flex',
          gap: 10,
        }}
      >
        <button
          type="button"
          onClick={handleComplete}
          disabled={setStatus.isPending}
          className="flex-1 flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:opacity-60"
          style={{ height: 54, borderRadius: 16, background: isDone ? '#fff' : '#1366CE', gap: 8, color: isDone ? '#1366CE' : '#fff', fontSize: 15, fontWeight: 800, boxShadow: isDone ? '0 5px 16px rgba(17,40,86,.05)' : undefined }}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={isDone ? '#1366CE' : '#fff'} strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M5 12.5l4.5 4.5L19 6.5" />
          </svg>
          {isDone ? t('taskDetail.reopen') : t('taskDetail.complete')}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={deleteTask.isPending}
          aria-label={t('taskDetail.deleteTask')}
          className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
          style={{ width: 54, height: 54, borderRadius: 16, background: '#fff', boxShadow: '0 5px 16px rgba(17,40,86,.05)' }}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#FF6B6B" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13" />
          </svg>
        </button>
      </div>

      {/* Photo viewer modal */}
      {viewPhoto && (
        <div
          className="fixed inset-0 flex items-center justify-center"
          style={{ zIndex: 50, background: 'rgba(10,20,40,.82)', padding: 24 }}
          onClick={() => setViewPhoto(null)}
          role="dialog"
          aria-modal="true"
          aria-label={t('taskDetail.viewPhoto')}
        >
          <img src={viewPhoto} alt={t('taskDetail.photoAlt')} style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 16 }} />
        </div>
      )}
    </div>
  )
}
