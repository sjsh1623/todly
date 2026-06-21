export type NotificationType =
  | 'live.started'
  | 'task.completed'
  | 'comment'
  | 'friend'
  | 'friend.request'
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
