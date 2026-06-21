import i18n from '../../shared/i18n/i18n'
import type { RecurFreq, Routine } from './types'

/** i18n weekday-label keys indexed 0=Mon .. 6=Sun (matches TaskCreate's order). */
export const WEEKDAY_KEYS = [
  'recurrence.dowMon',
  'recurrence.dowTue',
  'recurrence.dowWed',
  'recurrence.dowThu',
  'recurrence.dowFri',
  'recurrence.dowSat',
  'recurrence.dowSun',
] as const

/** Localized weekday short labels indexed 0=Mon .. 6=Sun. */
export function weekdayLabels(): string[] {
  return WEEKDAY_KEYS.map((k) => i18n.t(k))
}

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
 * Localized label for a routine's recurrence: "매일"/"Every day", "주말"/"Weekends",
 * "월·수·금"/"Mon·Wed·Fri", "매주"/"Weekly", "매달"/"Monthly".
 */
export function recurrenceLabel(freq: RecurFreq, rule: string | null | undefined): string {
  switch (freq) {
    case 'daily':
      return i18n.t('recurrence.daily')
    case 'weekly': {
      const days = parseWeekdays(rule)
      if (days.length === 0) return i18n.t('recurrence.weekly')
      if (days.length === 7) return i18n.t('recurrence.daily')
      if (days.length === 5 && [0, 1, 2, 3, 4].every((d) => days.includes(d))) return i18n.t('recurrence.weekdays')
      if (days.length === 2 && days.includes(5) && days.includes(6)) return i18n.t('recurrence.weekend')
      return days.map((d) => i18n.t(WEEKDAY_KEYS[d])).join('·')
    }
    case 'monthly':
      return i18n.t('recurrence.monthly')
    default:
      return i18n.t('recurrence.custom')
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
