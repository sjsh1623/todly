import { useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { subscribe } from '../live/stompClient'
import { prependNotification } from './hooks'
import type { NotificationCreatedPayload } from './types'

/**
 * Subscribes to the per-user notification queue. With @stomp/stompjs the server's
 * convertAndSendToUser lands on the client-visible destination
 * "/user/queue/notifications". Each {type:'notification.created'} envelope is
 * prepended to the cached list and bumps the unread count.
 */
export function useNotificationsRealtime(enabled: boolean) {
  const qc = useQueryClient()
  useEffect(() => {
    if (!enabled) return
    const unsub = subscribe('/user/queue/notifications', (message) => {
      try {
        const env = JSON.parse(message.body) as {
          type?: string
          payload?: NotificationCreatedPayload
        }
        const notification = env.payload?.notification
        if (notification) prependNotification(qc, notification)
      } catch (err) {
        console.error('[notifications] failed to handle event', err)
      }
    })
    return unsub
  }, [enabled, qc])
}
