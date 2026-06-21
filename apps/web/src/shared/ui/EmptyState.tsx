import type { ReactNode } from 'react'

type EmptyStateProps = {
  /** Optional decorative icon shown above the title. */
  icon?: ReactNode
  title: string
  subtitle?: string
  /** Optional call-to-action rendered below the copy. */
  action?: ReactNode
  className?: string
  /** Render the dashed-border card frame (default true). */
  bordered?: boolean
}

/**
 * Shared empty-state. Centered icon/title/subtitle with an optional action.
 * Token-consistent with the existing dashed-card pattern used across pages.
 */
export function EmptyState({
  icon,
  title,
  subtitle,
  action,
  className = '',
  bordered = true,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center ${className}`}
      style={
        bordered
          ? { border: '1.5px dashed #D6DEEA', borderRadius: 20, padding: '40px 20px' }
          : { padding: '40px 20px' }
      }
    >
      {icon && (
        <div
          className="flex items-center justify-center"
          aria-hidden="true"
          style={{ width: 56, height: 56, borderRadius: 18, background: '#EAF2FE', marginBottom: 16, color: '#1366CE' }}
        >
          {icon}
        </div>
      )}
      <p style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-text-muted)' }}>{title}</p>
      {subtitle && (
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-subtle)', marginTop: 4, maxWidth: 240 }}>
          {subtitle}
        </p>
      )}
      {action && <div style={{ marginTop: 18 }}>{action}</div>}
    </div>
  )
}
