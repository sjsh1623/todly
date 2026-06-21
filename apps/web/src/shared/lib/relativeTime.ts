/**
 * Korean relative-time labels matching the design copy:
 *   "방금", "2분 전", "12분 전", "1시간 전", "5시간 전",
 *   yesterday → "어제 · 18:40", older → "6월 3일".
 */
const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토']

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

  if (diffMin < 1) return '방금'
  if (diffMin < 60) return `${diffMin}분 전`

  const diffHr = Math.floor(diffMin / 60)
  if (isSameDay(then, now)) return `${diffHr}시간 전`

  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (isSameDay(then, yesterday)) return `어제 · ${hhmm(then)}`

  const diffDays = Math.floor(diffMs / 86400000)
  if (diffDays < 7) return `${WEEKDAYS_KO[then.getDay()]}요일 · ${hhmm(then)}`

  return `${then.getMonth() + 1}월 ${then.getDate()}일`
}
