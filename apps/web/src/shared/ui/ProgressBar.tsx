type ProgressBarProps = {
  value: number
}

export function ProgressBar({ value }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div
      className="w-full rounded-full overflow-hidden"
      style={{ height: 9, background: '#EDF1F7' }}
    >
      <div
        className="h-full rounded-full"
        style={{
          width: `${clamped}%`,
          background: 'linear-gradient(90deg,#34D9C4,#1366CE)',
        }}
      />
    </div>
  )
}
