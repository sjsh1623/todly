import { useEffect, useState } from 'react'
import * as authApi from './api'
import { useAuthStore } from './store'
import { syncPushIfGranted } from '../push'

/**
 * On app load: if a refresh token was persisted, mint a fresh access token and
 * (best-effort) hydrate the current user. Returns whether bootstrap finished so
 * route guards can avoid flashing the login screen.
 */
export function useAuthBootstrap(): boolean {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      const { refreshToken, setTokens, setUser, setStatus, logout } = useAuthStore.getState()

      if (!refreshToken) {
        setStatus('unauthenticated')
        if (!cancelled) setReady(true)
        return
      }

      setStatus('loading')
      try {
        const tokens = await authApi.refresh(refreshToken)
        if (cancelled) return
        setTokens(tokens)
        try {
          const user = await authApi.me()
          if (!cancelled) setUser(user)
        } catch {
          // /me failure is non-fatal; tokens are still valid.
        }
        if (!cancelled) setStatus('authenticated')
        // Best-effort: refresh this device's push token if already permitted.
        void syncPushIfGranted()
      } catch {
        if (!cancelled) logout()
      } finally {
        if (!cancelled) setReady(true)
      }
    }

    void bootstrap()
    return () => {
      cancelled = true
    }
  }, [])

  return ready
}
