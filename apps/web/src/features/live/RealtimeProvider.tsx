import { useEffect } from 'react'
import { useAuthStore } from '../auth/store'
import { useGroups } from '../groups/hooks'
import { connect, disconnect } from './stompClient'
import { useAllGroupsRealtime } from './useGroupRealtime'
import { useHeartbeat } from './hooks'
import { useLiveStore } from './store'
import { useNotificationsRealtime } from '../notifications/realtime'

/**
 * Mounted once near the app root. While authenticated it:
 *  - opens the STOMP connection (lazily, token pulled from the auth store),
 *  - subscribes to every group the user belongs to so Home + GroupDetail stay
 *    live regardless of which screen is showing,
 *  - posts presence heartbeats on an interval.
 * On logout it tears the connection (and live caches) down.
 */
export function RealtimeProvider({ children }: { children: React.ReactNode }) {
  const authed = useAuthStore((s) => s.status === 'authenticated' && Boolean(s.accessToken))
  // Only fetch groups once authenticated; firing /groups while logged out yields
  // a 401 that the axios interceptor turns into a forced redirect to /login,
  // which would make the public auth pages (e.g. /signup) unreachable.
  const { data: groups } = useGroups({ enabled: authed })
  const groupIds = groups?.map((g) => g.id) ?? []

  useEffect(() => {
    if (authed) {
      connect()
    } else {
      disconnect()
      useLiveStore.getState().reset()
    }
  }, [authed])

  useAllGroupsRealtime(authed ? groupIds : [])
  // Personal notification queue (convertAndSendToUser → /user/queue/notifications).
  useNotificationsRealtime(authed)
  useHeartbeat(authed)

  return <>{children}</>
}
