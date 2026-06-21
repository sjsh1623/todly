import type { ProfileColor } from '../auth/types'

// Values mirror the backend ActivityType enum (snake_case, serialized via
// Enum.name()). Keep in sync with apps/api .../activity/ActivityType.java.
export type ActivityType =
  | 'task_created'
  | 'task_completed'
  | 'task_reopened'
  | 'live_started'
  | 'live_ended'
  | 'member_joined'
  | 'comment_added'
  | 'routine_done'
  | 'milestone_reached'
  | 'friend_joined_room'
  | 'photo_shared'
  | string

export type ActivityActor = {
  userId: string
  nickname: string
  profileColor: ProfileColor
}

/**
 * One timeline entry. `meta` is a free-form bag the renderer reads opportunistically
 * (e.g. completedCount, percent, live:true) so new server variants degrade gracefully.
 */
export type Activity = {
  id: string
  type: ActivityType
  actor: ActivityActor
  targetTaskId?: string | null
  targetTitle?: string | null
  meta?: Record<string, unknown> | null
  createdAt: string
  /** Present on the merged "전체" feed. */
  groupId?: string
  groupName?: string
}

export type ActivityPage = {
  items: Activity[]
  nextCursor: string | null
}

/** Realtime envelope payload for activity.created on a group topic. */
export type ActivityCreatedPayload = {
  activity: Activity
}
