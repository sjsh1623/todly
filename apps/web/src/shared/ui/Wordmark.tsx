type WordmarkProps = {
  size?: number
}

/** The "todly" Sora wordmark in the primary-strong brand color. */
export function Wordmark({ size = 40 }: WordmarkProps) {
  return (
    <span
      className="font-display select-none"
      style={{
        fontFamily: 'var(--font-display)',
        fontSize: size,
        fontWeight: 800,
        letterSpacing: '-.05em',
        color: '#1366CE',
      }}
    >
      todly
    </span>
  )
}
