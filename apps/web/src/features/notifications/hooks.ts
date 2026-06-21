import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from '@tanstack/react-query'
import * as notifApi from './api'
import type { Notification, NotificationPage, NotificationSettings } from './types'

export const notificationKeys = {
  all: ['notifications'] as const,
  list: () => ['notifications', 'list'] as const,
  settings: () => ['notifications', 'settings'] as const,
}

export function useNotifications() {
  return useInfiniteQuery<NotificationPage>({
    queryKey: notificationKeys.list(),
    queryFn: ({ pageParam }) => notifApi.getNotifications(pageParam as string | null),
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
  })
}

/** Reactive unread count from the first cached page (kept fresh by realtime). */
export function useUnreadCount(): number {
  const { data } = useNotifications()
  return data?.pages[0]?.unreadCount ?? 0
}

function bumpUnread(page: NotificationPage, delta: number): number {
  return Math.max(0, (page.unreadCount ?? 0) + delta)
}

/**
 * Prepends a freshly-arrived notification to the cached list + bumps unreadCount.
 * De-duped by id. Used by the realtime subscription.
 */
export function prependNotification(
  qc: ReturnType<typeof useQueryClient>,
  notification: Notification,
) {
  qc.setQueryData<InfiniteData<NotificationPage>>(notificationKeys.list(), (data) => {
    if (!data) return data
    const exists = data.pages.some((p) => p.items.some((n) => n.id === notification.id))
    if (exists) return data
    const [first, ...rest] = data.pages
    const firstPage: NotificationPage =
      first ?? { items: [], nextCursor: null, unreadCount: 0 }
    return {
      ...data,
      pages: [
        {
          ...firstPage,
          items: [notification, ...firstPage.items],
          unreadCount: bumpUnread(firstPage, notification.isRead ? 0 : 1),
        },
        ...rest,
      ],
    }
  })
}

export function useMarkRead() {
  const qc = useQueryClient()
  return useMutation<void, unknown, string>({
    mutationFn: notifApi.markRead,
    onMutate: (id) => {
      qc.setQueryData<InfiniteData<NotificationPage>>(notificationKeys.list(), (data) => {
        if (!data) return data
        let decremented = false
        const pages = data.pages.map((p, idx) => {
          const items = p.items.map((n) => {
            if (n.id === id && !n.isRead) {
              decremented = true
              return { ...n, isRead: true }
            }
            return n
          })
          // unreadCount lives on the first page; decrement once.
          const unreadCount = idx === 0 && decremented ? bumpUnread(p, -1) : p.unreadCount
          return { ...p, items, unreadCount }
        })
        return { ...data, pages }
      })
    },
  })
}

export function useMarkAllRead() {
  const qc = useQueryClient()
  return useMutation<void, unknown, void>({
    mutationFn: notifApi.markAllRead,
    onMutate: () => {
      qc.setQueryData<InfiniteData<NotificationPage>>(notificationKeys.list(), (data) => {
        if (!data) return data
        return {
          ...data,
          pages: data.pages.map((p, idx) => ({
            ...p,
            items: p.items.map((n) => ({ ...n, isRead: true })),
            unreadCount: idx === 0 ? 0 : p.unreadCount,
          })),
        }
      })
    },
  })
}

export function useNotificationSettings() {
  return useQuery<NotificationSettings>({
    queryKey: notificationKeys.settings(),
    queryFn: notifApi.getSettings,
  })
}

export function useUpdateNotificationSettings() {
  const qc = useQueryClient()
  return useMutation<NotificationSettings, unknown, Partial<NotificationSettings>>({
    mutationFn: notifApi.updateSettings,
    onMutate: (patch) => {
      const prev = qc.getQueryData<NotificationSettings>(notificationKeys.settings())
      if (prev) qc.setQueryData(notificationKeys.settings(), { ...prev, ...patch })
      return { prev }
    },
    onError: (_e, _patch, ctx) => {
      const prev = (ctx as { prev?: NotificationSettings } | undefined)?.prev
      if (prev) qc.setQueryData(notificationKeys.settings(), prev)
    },
    onSuccess: (data) => {
      qc.setQueryData(notificationKeys.settings(), data)
    },
  })
}
