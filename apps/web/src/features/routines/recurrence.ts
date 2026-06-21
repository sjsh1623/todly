import type { RecurFreq, Routine } from './types'

/** Weekday labels indexed 0=Mon .. 6=Sun (matches TaskCreate's WEEKDAYS order). */
export const WEEKDAYS_KO = ['월', '화', '수', '목', '금', '토', '일']

/** Parses a "0,2,4" rule into an array of weekday indices. */
export function parseWeekdays(rule: string | null | undefined): number[] {
  if (!rule) return []
  return rule
    .split(',')
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n >= 0 && n <= 6)
}

/** Serializes weekday indices into a "0,2,4" rule. */
export function serializeWeekdays(days: number[]): string {
  return [...days].sort((a, b) => a - b).join(',')
}

/**
 * Human label for a routine's recurrence: "매일", "주말", "월·수·금", "매주", "매달".
 */
export function recurrenceLabel(freq: RecurFreq, rule: string | null | undefined): string {
  switch (freq) {
    case 'daily':
      return '매일'
    case 'weekly': {
      const days = parseWeekdays(rule)
      if (days.length === 0) return '매주'
      if (days.length === 7) return '매일'
      if (days.length === 5 && [0, 1, 2, 3, 4].every((d) => days.includes(d))) return '평일'
      if (days.length === 2 && days.includes(5) && days.includes(6)) return '주말'
      return days.map((d) => WEEKDAYS_KO[d]).join('·')
    }
    case 'monthly':
      return '매달'
    default:
      return '맞춤'
  }
}

/** "{time} · {recurrence}" — e.g. "6:30 · 매일". Falls back to just one part. */
export function routineMetaLine(routine: Routine): string {
  const rec = recurrenceLabel(routine.recurFreq, routine.recurRule)
  const time = formatTimeOfDay(routine.timeOfDay)
  return time ? `${time} · ${rec}` : rec
}

/** "06:30" → "6:30"; leaves other strings as-is. */
export function formatTimeOfDay(t: string | null | undefined): string {
  if (!t) return ''
  const m = /^(\d{1,2}):(\d{2})/.exec(t)
  if (!m) return t
  return `${Number(m[1])}:${m[2]}`
}

/** Minutes until nextRunAt, or undefined when in the past / unknown. */
export function minutesUntil(nextRunAt: string | null | undefined, now = new Date()): number | undefined {
  if (!nextRunAt) return undefined
  const d = new Date(nextRunAt)
  if (Number.isNaN(d.getTime())) return undefined
  const mins = Math.round((d.getTime() - now.getTime()) / 60000)
  return mins >= 0 ? mins : undefined
}
