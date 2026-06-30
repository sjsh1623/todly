import type { ReactNode } from 'react'

type AuthScreenProps = {
  /** @deprecated retained for call-site compatibility; the shell is now flat. */
  gradientHeader?: boolean
  children: ReactNode
}

/**
 * Clean full-screen shell for the public auth routes (login / signup / reset).
 *
 * Pinned with `position: fixed` so the *document* never scrolls. The content is
 * vertically centred via auto margins and only scrolls *inside* the shell when
 * it genuinely can't fit (very small devices) — so a normal phone shows the
 * form perfectly centred with no scroll, while a tiny one can still reach
 * everything. Safe-area padding paints and clears the notch / home indicator
 * (edge-to-edge), so there's no white strip at the top.
 */
export function AuthScreen({ children }: AuthScreenProps) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        background: 'var(--color-bg-2)',
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          minHeight: '100%',
          width: '100%',
          maxWidth: 440,
          boxSizing: 'border-box',
          display: 'flex',
          flexDirection: 'column',
          padding:
            'calc(env(safe-area-inset-top, 0px) + 24px) 26px calc(env(safe-area-inset-bottom, 0px) + 20px)',
        }}
      >
        {/* auto top+bottom margins centre the block, and collapse to a normal
            top-aligned scroll when the content is taller than the viewport. */}
        <div style={{ margin: 'auto 0', width: '100%' }}>{children}</div>
      </div>
    </div>
  )
}
