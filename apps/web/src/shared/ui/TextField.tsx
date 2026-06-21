import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react'

type TextFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string
  /** Right-aligned helper shown in the label row (e.g. a "2/12" counter). */
  labelAccessory?: ReactNode
  /** Content rendered inside the field, after the input (e.g. an eye toggle). */
  trailing?: ReactNode
  /** Inline error message (renders red + sets aria-invalid). */
  error?: string
  /** Non-error helper text under the field. */
  hint?: ReactNode
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, labelAccessory, trailing, error, hint, className = '', id, ...rest },
  ref,
) {
  const autoId = useId()
  const inputId = id ?? autoId
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined

  return (
    <div className={className}>
      <div className="flex items-center justify-between" style={{ margin: '0 0 8px 2px' }}>
        <label htmlFor={inputId} style={{ fontSize: 12.5, fontWeight: 700, color: '#7C8AA0' }}>
          {label}
        </label>
        {labelAccessory}
      </div>
      <div
        className="flex items-center justify-between gap-2 focus-within:ring-2 focus-within:ring-primary/40"
        style={{
          background: '#fff',
          border: `1.5px solid ${error ? 'var(--color-due)' : '#E6ECF4'}`,
          borderRadius: 16,
          padding: 16,
          boxShadow: '0 4px 12px rgba(20,50,90,.04)',
        }}
      >
        <input
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className="flex-1 min-w-0 bg-transparent outline-none placeholder:text-[#B4BFCE]"
          style={{ fontSize: 15, fontWeight: 600, color: 'var(--color-text)' }}
          {...rest}
        />
        {trailing}
      </div>
      {error ? (
        <p
          id={`${inputId}-error`}
          role="alert"
          style={{ margin: '8px 0 0 2px', fontSize: 12.5, fontWeight: 600, color: 'var(--color-due)' }}
        >
          {error}
        </p>
      ) : hint ? (
        <div id={`${inputId}-hint`} style={{ margin: '8px 0 0 2px', fontSize: 12.5, fontWeight: 600 }}>
          {hint}
        </div>
      ) : null}
    </div>
  )
})
