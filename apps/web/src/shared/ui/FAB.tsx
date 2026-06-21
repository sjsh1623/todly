import type { ButtonHTMLAttributes } from 'react'

type FABProps = ButtonHTMLAttributes<HTMLButtonElement>

export function FAB({ className = '', style, ...rest }: FABProps) {
  return (
    <button
      aria-label="추가"
      className={`absolute right-4 z-10 flex items-center justify-center text-white ${className}`}
      style={{
        bottom: 92 + 16,
        width: 58,
        height: 58,
        borderRadius: 20,
        background: '#1366CE',
        boxShadow: '0 10px 24px rgba(19,102,206,.35)',
        ...style,
      }}
      {...rest}
    >
      <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth={2.4} strokeLinecap="round">
        <path d="M12 5v14M5 12h14" />
      </svg>
    </button>
  )
}
