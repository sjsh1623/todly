import type { CSSProperties } from 'react'

type SkeletonProps = {
  width?: number | string
  height?: number | string
  radius?: number
  className?: string
  style?: CSSProperties
  circle?: boolean
}

/**
 * A single shimmering placeholder block. Respects prefers-reduced-motion via
 * the shared `.tdl-skeleton` rule in index.css.
 */
export function Skeleton({ width = '100%', height = 14, radius = 8, circle = false, className = '', style }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={`tdl-skeleton ${className}`}
      style={{
        width,
        height: circle ? width : height,
        borderRadius: circle ? '50%' : radius,
        ...style,
      }}
    />
  )
}

/**
 * A list of card-shaped skeleton rows. Used while page lists load.
 */
export function SkeletonList({ rows = 4, gap = 12 }: { rows?: number; gap?: number }) {
  return (
    <div role="status" aria-label="불러오는 중" className="flex flex-col" style={{ gap }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center"
          style={{ gap: 13, background: 'var(--color-card)', borderRadius: 18, padding: 15, boxShadow: '0 5px 16px rgba(17,40,86,.05)' }}
        >
          <Skeleton width={42} circle />
          <div style={{ flex: 1 }}>
            <Skeleton width="62%" height={13} />
            <Skeleton width="40%" height={11} style={{ marginTop: 8 }} />
          </div>
        </div>
      ))}
    </div>
  )
}
