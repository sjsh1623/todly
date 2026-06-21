import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { useAuthBootstrap, useAuthStore } from '../features/auth'
import { applyTheme } from '../features/settings/theme'

/**
 * Wraps every route. Runs auth bootstrap once and holds rendering until it
 * resolves so protected routes don't flash the login screen on reload.
 */
export function RootLayout() {
  const ready = useAuthBootstrap()
  const theme = useAuthStore((s) => s.user?.theme)
  const darkMode = useAuthStore((s) => s.user?.darkMode)

  // Apply the user's theme + dark mode to <html> on load and whenever they
  // change (persisted user is hydrated synchronously, refreshed by bootstrap).
  useEffect(() => {
    applyTheme(theme, Boolean(darkMode))
  }, [theme, darkMode])

  if (!ready) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: 'var(--color-bg)' }}
        aria-busy="true"
      >
        <span className="font-display" style={{ fontSize: 28, fontWeight: 800, color: '#1366CE', letterSpacing: '-.05em' }}>
          todly
        </span>
      </div>
    )
  }

  return <Outlet />
}
