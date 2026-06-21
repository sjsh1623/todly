import type { ReactNode } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '../features/auth'

/**
 * Gate for the protected app routes. A user is considered authenticated if a
 * refresh token is present (bootstrap will mint a fresh access token). This
 * keeps the guard working across reloads before the access token is restored.
 */
export function RequireAuth({ children }: { children: ReactNode }) {
  const location = useLocation()
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const status = useAuthStore((s) => s.status)

  const authed = Boolean(refreshToken) && status !== 'unauthenticated'

  if (!authed) {
    const from = location.pathname + location.search
    return <Navigate to="/login" replace state={{ from }} />
  }

  return <>{children}</>
}
