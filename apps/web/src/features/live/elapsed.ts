import type { LiveSessionStatus } from './types'

/**
 * Whole seconds elapsed since `startedAt`, minus accumulated paused time.
 * Clamped at 0 to avoid negatives from clock skew.
 */
export function elapsedSeconds(
  startedAt: string,
  pausedSeconds = 0,
  now: number = Date.now(),
): number {
  const start = new Date(startedAt).getTime()
  if (Number.isNaN(start)) return 0
  const secs = Math.floor((now - start) / 1000) - pausedSeconds
  return secs < 0 ? 0 : secs
}

/**
 * Short, design-consistent label for a live duration.
 *   < 60s        → "방금 전"
 *   < 60m        → "N분"
 *   >= 60m       → "H시간 M분"
 */
export function formatElapsed(seconds: number): string {
  if (seconds < 60) return '방금 전'
  const mins = Math.floor(seconds / 60)
  if (mins < 60) return `${mins}분`
  const hrs = Math.floor(mins / 60)
  const rem = mins % 60
  return rem === 0 ? `${hrs}시간` : `${hrs}시간 ${rem}분`
}

/** Variant used in the home card subtitle: "방금 시작" / "N분 전 시작". */
export function formatElapsedSince(seconds: number): string {
  if (seconds < 60) return '방금 시작'
  return `${formatElapsed(seconds)} 전 시작`
}

/** Big mm:ss / h:mm:ss stopwatch label for the SCR-06 live screen. */
export function formatStopwatch(seconds: number): string {
  const h = Math.floor(seconds / 3600)
  const m = Math.floor((seconds % 3600) / 60)
  const s = seconds % 60
  const pad = (n: number) => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${pad(m)}:${pad(s)}`
}

export type ElapsedFormat = 'short' | 'since' | 'stopwatch'

export function formatBy(format: ElapsedFormat, seconds: number): string {
  switch (format) {
    case 'since':
      return formatElapsedSince(seconds)
    case 'stopwatch':
      return formatStopwatch(seconds)
    default:
      return formatElapsed(seconds)
  }
}

export type { LiveSessionStatus }
