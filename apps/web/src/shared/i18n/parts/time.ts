/**
 * Relative-time + presence strings. These used to be hardcoded Korean inside
 * lib/relativeTime.ts and features/friends/presence.ts; they now resolve through
 * i18n so English users see English.
 *
 * Flat dotted keys (see i18n.ts). `timeKo` and `timeEn` MUST share a key set.
 * Relative-time interpolations use {{n}} (not {{count}}) to avoid i18next's
 * plural machinery — both languages use a single form here.
 */
export const timeKo = {
  // relativeTime.ts
  'relativeTime.justNow': '방금',
  'relativeTime.minutesAgo': '{{n}}분 전',
  'relativeTime.hoursAgo': '{{n}}시간 전',
  'relativeTime.yesterday': '어제 · {{time}}',
  'relativeTime.weekday': '{{day}}요일 · {{time}}',
  'relativeTime.monthDay': '{{month}}월 {{day}}일',
  'relativeTime.weekdaySun': '일',
  'relativeTime.weekdayMon': '월',
  'relativeTime.weekdayTue': '화',
  'relativeTime.weekdayWed': '수',
  'relativeTime.weekdayThu': '목',
  'relativeTime.weekdayFri': '금',
  'relativeTime.weekdaySat': '토',

  // presence.ts
  'presence.activeNow': '지금 활동 중',
  'presence.online': '온라인',
  'presence.offline': '오프라인',

  // elapsed.ts — live session duration labels
  'elapsed.justNow': '방금 전',
  'elapsed.minutes': '{{n}}분',
  'elapsed.hours': '{{n}}시간',
  'elapsed.hoursMinutes': '{{h}}시간 {{m}}분',
  'elapsed.justStarted': '방금 시작',
  'elapsed.sinceStart': '{{elapsed}} 전 시작',
}

export const timeEn = {
  // relativeTime.ts
  'relativeTime.justNow': 'Just now',
  'relativeTime.minutesAgo': '{{n}} min ago',
  'relativeTime.hoursAgo': '{{n}}h ago',
  'relativeTime.yesterday': 'Yesterday · {{time}}',
  'relativeTime.weekday': '{{day}} · {{time}}',
  'relativeTime.monthDay': '{{month}}/{{day}}',
  'relativeTime.weekdaySun': 'Sun',
  'relativeTime.weekdayMon': 'Mon',
  'relativeTime.weekdayTue': 'Tue',
  'relativeTime.weekdayWed': 'Wed',
  'relativeTime.weekdayThu': 'Thu',
  'relativeTime.weekdayFri': 'Fri',
  'relativeTime.weekdaySat': 'Sat',

  // presence.ts
  'presence.activeNow': 'Active now',
  'presence.online': 'Online',
  'presence.offline': 'Offline',

  // elapsed.ts — live session duration labels
  'elapsed.justNow': 'just now',
  'elapsed.minutes': '{{n}}m',
  'elapsed.hours': '{{n}}h',
  'elapsed.hoursMinutes': '{{h}}h {{m}}m',
  'elapsed.justStarted': 'just started',
  'elapsed.sinceStart': 'started {{elapsed}} ago',
}
