import type { HTMLAttributes } from 'react'

type CardProps = HTMLAttributes<HTMLDivElement>

export function Card({ className = '', style, children, ...rest }: CardProps) {
  return (
    <div
      className={`bg-card rounded-card-lg p-4 ${className}`}
      style={{ boxShadow: '0 5px 16px rgba(17,40,86,.05)', ...style }}
      {...rest}
    >
      {children}
    </div>
  )
}
