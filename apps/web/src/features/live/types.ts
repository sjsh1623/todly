import type { ProfileColor } from '../auth/types'
import type { LiveNowEntry, Task, TaskProgress } from '../tasks/types'

export type { LiveNowEntry }

export type LiveSessionStatus = 'active' | 'paused'

/** An in-flight live work session on a task. */
export type LiveSession = {
  id: string
  taskId: string
  taskTitle: string
  /**
   * The group this session belongs to. Not always present on the wire payload,
   * so the realtime/start handlers backfill it from the envelope / mutation vars.
   */
  groupId?: string
  userId: string
  nickname: string
  profileColor: ProfileColor
  /** ISO timestamp of when the session originally started. */
  startedAt: string
  status: LiveSessionStatus
  /**
   * Accumulated paused seconds. Optional — the backend may or may not send it;
   * when absent we treat it as 0 so the elapsed timer still ticks sensibly.
   */
  pausedSeconds?: number
}

// ---- STOMP envelope + payloads ----

export type RealtimeEventType =
  | 'task.created'
  | 'task.updated'
  | 'task.completed'
  | 'task.reopened'
  | 'task.deleted'
  | 'live.started'
  | 'live.paused'
  | 'live.ended'
  | 'presence.updated'
  | 'activity.created'

export type RealtimeEnvelope<P = unknown> = {
  type: RealtimeEventType
  groupId: string
  payload: P
  at: string
}

export type TaskEventPayload = {
  task: Task
  progress: TaskProgress
}

export type LiveStartedPayload = { session: LiveSession }
export type LivePausedPayload = { session: LiveSession }
export type LiveEndedPayload = { sessionId: string; taskId: string; userId: string }

export type PresenceUpdatedPayload = {
  groupId: string
  onlineCount: number
  online: string[]
}
