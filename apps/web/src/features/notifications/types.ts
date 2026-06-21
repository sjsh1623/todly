// Values mirror the backend NotificationType enum (snake_case, serialized via
// Enum.name()). Keep in sync with apps/api .../notification/NotificationType.java.
export type NotificationType =
  | 'due_soon'
  | 'overdue'
  | 'assigned'
  | 'live_started'
  | 'milestone'
  | 'mention'
  | 'invite'
  | 'comment'
  | 'friend_request'
  | 'friend_accepted'
  | 'room_cheer'
  | string

export type Notification = {
  id: string
  type: NotificationType
  title: string
  body: string | null
  /** In-app deep link (e.g. "/groups/123" or "/rooms/abc"). */
  link: string | null
  isRead: boolean
  createdAt: string
}

export type NotificationPage = {
  items: Notification[]
  nextCursor: string | null
  unreadCount: number
}

/** Maps to SCR-14 toggles. */
export type NotificationSettings = {
  pushDue: boolean
  pushAssigned: boolean
  pushLive: boolean
  pushComment: boolean
  quietFrom: string | null
  quietTo: string | null
}

/** Realtime envelope payload delivered on /user/queue/notifications. */
export type NotificationCreatedPayload = {
  notification: Notification
}
