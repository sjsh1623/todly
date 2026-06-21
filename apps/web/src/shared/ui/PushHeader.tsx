import type { ReactNode } from 'react'

type PushHeaderProps = {
  title?: string
  onBack: () => void
  /** Optional trailing action (e.g. a kebab menu button). */
  trailing?: ReactNode
}

/** A back-navigation header for full-screen pushed views (light variant). */
export function PushHeader({ title, onBack, trailing }: PushHeaderProps) {
  return (
    <div
      className="relative flex items-center justify-between"
      style={{ height: 58, padding: '0 22px', zIndex: 10 }}
    >
      <button
        type="button"
        onClick={onBack}
        aria-label="뒤로"
        className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        style={{ width: 38, height: 38, borderRadius: 13, background: '#fff', boxShadow: '0 4px 12px rgba(20,50,90,.06)' }}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#14233A" strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round">
          <path d="M15 5l-7 7 7 7" />
        </svg>
      </button>
      {title ? (
        <h1 style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-text)' }}>{title}</h1>
      ) : (
        <div />
      )}
      <div className="flex items-center justify-center" style={{ minWidth: 38, height: 38 }}>
        {trailing}
      </div>
    </div>
  )
}
