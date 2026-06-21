/**
 * Localized relative-time labels (see i18n parts/time.ts), matching the design copy:
 *   ko: "방금", "2분 전", "5시간 전", "어제 · 18:40", "수요일 · 14:30", "6월 3일"
 *   en: "Just now", "2 min ago", "5h ago", "Yesterday · 18:40", "Wed · 14:30", "6/3"
 */
import i18n from '../i18n/i18n'

const WEEKDAY_KEYS = [
  'relativeTime.weekdaySun',
  'relativeTime.weekdayMon',
  'relativeTime.weekdayTue',
  'relativeTime.weekdayWed',
  'relativeTime.weekdayThu',
  'relativeTime.weekdayFri',
  'relativeTime.weekdaySat',
] as const

function hhmm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''

  const diffMs = now.getTime() - then.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return i18n.t('relativeTime.justNow')
  if (diffMin < 60) return i18n.t('relativeTime.minutesAgo', { n: diffMin })

  const diffHr = Math.floor(diffMin / 60)
  if (isSameDay(then, now)) return i18n.t('relativeTime.hoursAgo', { n: diffHr })

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(then, yesterday)) return i18n.t('relativeTime.yesterday', { time: hhmm(then) })

  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays < 7) {
    return i18n.t('relativeTime.weekday', { day: i18n.t(WEEKDAY_KEYS[then.getDay()]), time: hhmm(then) })
  }

  return i18n.t('relativeTime.monthDay', { month: then.getMonth() + 1, day: then.getDate() })
}
