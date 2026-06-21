import type { ReactNode } from 'react'
import { StatusBar } from './StatusBar'

type AuthScreenProps = {
  /** When set, paints the soft blue gradient band behind the top of the screen. */
  gradientHeader?: boolean
  children: ReactNode
}

/**
 * Full-screen phone frame used by the public auth routes (no bottom nav).
 * Mirrors the AppShell centering but with the #F2F6FC auth background.
 */
export function AuthScreen({ gradientHeader = false, children }: AuthScreenProps) {
  return (
    <div className="min-h-screen flex justify-center" style={{ background: 'var(--color-bg)' }}>
      <div
        className="relative w-full max-w-[420px] min-h-screen overflow-hidden"
        style={{ background: '#F2F6FC' }}
      >
        <StatusBar />
        {gradientHeader && (
          <div
            className="absolute left-0 right-0 top-0 pointer-events-none"
            style={{ height: 300, background: 'linear-gradient(180deg,#E2EEFD 0%,#F2F6FC 100%)' }}
            aria-hidden="true"
          />
        )}
        <div className="relative">{children}</div>
      </div>
    </div>
  )
}
