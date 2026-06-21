import type { ButtonHTMLAttributes } from 'react'

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary'
}

export function Button({
  variant = 'primary',
  className = '',
  style,
  children,
  ...rest
}: ButtonProps) {
  const base =
    'w-full inline-flex items-center justify-center px-5 transition-opacity active:opacity-80 disabled:opacity-50'
  const variantStyle =
    variant === 'primary'
      ? { background: '#1366CE', color: '#FFFFFF', borderRadius: 18, height: 56, fontWeight: 800 }
      : {
          background: '#FFFFFF',
          color: 'var(--color-text)',
          border: '1px solid #E6ECF4',
          borderRadius: 18,
          height: 56,
          fontWeight: 800,
        }

  return (
    <button className={`${base} ${className}`} style={{ ...variantStyle, ...style }} {...rest}>
      {children}
    </button>
  )
}
