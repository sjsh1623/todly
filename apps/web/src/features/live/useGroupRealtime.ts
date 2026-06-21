import { useEffect } from 'react'
import { useQueryClient, type QueryClient } from '@tanstack/react-query'
import { subscribe } from './stompClient'
import { useLiveStore } from './store'
import { taskKeys } from '../tasks/hooks'
import { groupKeys } from '../groups/hooks'
import { prependActivity } from '../activity/hooks'
import type { Activity, ActivityCreatedPayload } from '../activity/types'
import type { GroupTasks, Section, Task, TaskProgress } from '../tasks/types'
import type { GroupDetail } from '../groups/types'
import type {
  LiveEndedPayload,
  LivePausedPayload,
  LiveStartedPayload,
  PresenceUpdatedPayload,
  RealtimeEnvelope,
  TaskEventPayload,
} from './types'

function percentOf(done: number, total: number): number {
  return total === 0 ? 0 : Math.round((done / total) * 100)
}

function tally(tasks: Task[]): { done: number; total: number } {
  let done = 0
  let total = 0
  for (const t of tasks) {
    if (t.status === 'archived') continue
    total += 1
    if (t.status === 'done') done += 1
  }
  return { done, total }
}

/** Recomputes a section's progress from its task list. */
function withSectionProgress(section: Section): Section {
  return { ...section, progress: tally(section.tasks) }
}

/**
 * Inserts/replaces/removes a task in the cached GroupTasks tree, then applies
 * the server-sent overall progress (authoritative) and recomputes per-section
 * progress. `removed` drops the task entirely (task.deleted).
 */
function applyTaskEvent(
  data: GroupTasks,
  task: Task,
  progress: TaskProgress | undefined,
  removed: boolean,
): GroupTasks {
  const inTarget = (t: Task) => t.id === task.id

  // Remove the task from wherever it currently lives.
  let sections = data.sections.map((s) => ({
    ...s,
    tasks: s.tasks.filter((t) => !inTarget(t)),
  }))
  let unsectioned = data.unsectioned.filter((t) => !inTarget(t))

  if (!removed) {
    // Place the (new or updated) task into its section, or unsectioned.
    if (task.sectionId) {
      let placed = false
      sections = sections.map((s) => {
        if (s.id !== task.sectionId) return s
        placed = true
        const tasks = [...s.tasks, task].sort((a, b) => a.position - b.position)
        return { ...s, tasks }
      })
      // If the section isn't in cache yet, fall back to unsectioned so the task
      // is still visible until the next refetch fills it in.
      if (!placed) unsectioned = [...unsectioned, task].sort((a, b) => a.position - b.position)
    } else {
      unsectioned = [...unsectioned, task].sort((a, b) => a.position - b.position)
    }
  }

  sections = sections.map(withSectionProgress)

  // Server progress wins; otherwise recompute from the tree.
  let overall: TaskProgress
  if (progress) {
    overall = { ...progress, percent: progress.percent ?? percentOf(progress.done, progress.total) }
  } else {
    const all = [...sections.flatMap((s) => s.tasks), ...unsectioned]
    const { done, total } = tally(all)
    overall = { done, total, percent: percentOf(done, total) }
  }

  return { sections, unsectioned, progress: overall }
}

/** Flips a task's status in cache (used by live.* so the in_progress UI shows). */
function setTaskStatus(data: GroupTasks, taskId: string, status: Task['status']): GroupTasks {
  const apply = (t: Task): Task => (t.id === taskId ? { ...t, status } : t)
  return {
    ...data,
    sections: data.sections.map((s) => ({ ...s, tasks: s.tasks.map(apply) })),
    unsectioned: data.unsectioned.map(apply),
  }
}

/** Handles one decoded envelope for a group, mutating caches + the live store. */
export function applyRealtimeEvent(qc: QueryClient, env: RealtimeEnvelope) {
  const { type, groupId } = env
  const groupKey = taskKeys.groupTasks(groupId)
  const store = useLiveStore.getState()

  switch (type) {
    case 'task.created':
    case 'task.updated':
    case 'task.completed':
    case 'task.reopened':
    case 'task.deleted': {
      const p = env.payload as TaskEventPayload
      if (!p?.task) break
      const existing = qc.getQueryData<GroupTasks>(groupKey)
      if (existing) {
        qc.setQueryData<GroupTasks>(
          groupKey,
          applyTaskEvent(existing, p.task, p.progress, type === 'task.deleted'),
        )
      }
      // Home holds needsAttention + groupProgress derived from tasks; let it refetch.
      qc.invalidateQueries({ queryKey: taskKeys.home })
      break
    }

    case 'live.started':
    case 'live.paused': {
      const p = env.payload as LiveStartedPayload | LivePausedPayload
      if (!p?.session) break
      store.upsertSession({ ...p.session, groupId: p.session.groupId ?? groupId })
      const existing = qc.getQueryData<GroupTasks>(groupKey)
      if (existing) {
        qc.setQueryData<GroupTasks>(groupKey, setTaskStatus(existing, p.session.taskId, 'in_progress'))
      }
      qc.invalidateQueries({ queryKey: taskKeys.home })
      break
    }

    case 'live.ended': {
      const p = env.payload as LiveEndedPayload
      if (p?.sessionId) store.removeSession(p.sessionId)
      if (p?.taskId) {
        store.removeSessionByTask(p.taskId)
        const existing = qc.getQueryData<GroupTasks>(groupKey)
        if (existing) {
          // Reflect end of live: drop the in_progress visual. The actual final
          // status (done/todo) arrives via a following task.* event or refetch.
          const current = existing.sections
            .flatMap((s) => s.tasks)
            .concat(existing.unsectioned)
            .find((t) => t.id === p.taskId)
          if (current?.status === 'in_progress') {
            qc.setQueryData<GroupTasks>(groupKey, setTaskStatus(existing, p.taskId, 'todo'))
          }
        }
      }
      qc.invalidateQueries({ queryKey: taskKeys.home })
      break
    }

    case 'activity.created': {
      const p = env.payload as ActivityCreatedPayload
      const activity = p?.activity
      if (!activity) break
      // Backfill the group so it lands in the right per-group feed (and the
      // merged feed shows which group it came from).
      const enriched: Activity = { ...activity, groupId: activity.groupId ?? groupId }
      prependActivity(qc, enriched)
      break
    }

    case 'presence.updated': {
      const p = env.payload as PresenceUpdatedPayload
      if (!p) break
      store.setOnline(groupId, p.onlineCount)
      const detail = qc.getQueryData<GroupDetail>(groupKeys.detail(groupId))
      if (detail) {
        const online = new Set(p.online ?? [])
        qc.setQueryData<GroupDetail>(groupKeys.detail(groupId), {
          ...detail,
          onlineCount: p.onlineCount,
          members: detail.members.map((m) => ({ ...m, online: online.has(m.userId) })),
        })
      }
      break
    }
  }
}

/** Subscribes to a single group's topic and reconciles events into caches. */
export function useGroupRealtime(groupId: string | undefined) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!groupId) return
    const unsub = subscribe(`/topic/groups/${groupId}`, (message) => {
      try {
        const env = JSON.parse(message.body) as RealtimeEnvelope
        applyRealtimeEvent(qc, env)
      } catch (err) {
        console.error('[realtime] failed to handle event', err)
      }
    })
    return unsub
  }, [groupId, qc])
}

/** Subscribes to all of my groups at once (mounted globally). */
export function useAllGroupsRealtime(groupIds: string[]) {
  const qc = useQueryClient()
  const key = groupIds.join(',')
  useEffect(() => {
    if (groupIds.length === 0) return
    const unsubs = groupIds.map((gid) =>
      subscribe(`/topic/groups/${gid}`, (message) => {
        try {
          const env = JSON.parse(message.body) as RealtimeEnvelope
          applyRealtimeEvent(qc, env)
        } catch (err) {
          console.error('[realtime] failed to handle event', err)
        }
      }),
    )
    return () => unsubs.forEach((u) => u())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, qc])
}
