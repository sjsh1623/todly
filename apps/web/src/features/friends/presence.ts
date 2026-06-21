import { relativeTime } from '../../shared/lib/relativeTime'

/**
 * Maps a friend's presence to the design's status copy:
 *   online + recent activity → "지금 활동 중"
 *   online (idle)           → "온라인"
 *   offline                 → relative time ("2시간 전" / "어제" / "3일 전")
 */
export function presenceText(
  online: boolean,
  lastActiveAt: string | null,
  now: Date = new Date(),
): string {
  if (online) {
    if (lastActiveAt) {
      const diffMs = now.getTime() - new Date(lastActiveAt).getTime()
      // Active within the last 5 minutes counts as "currently active".
      if (!Number.isNaN(diffMs) && diffMs < 5 * 60_000) return '지금 활동 중'
    }
    return '온라인'
  }
  if (!lastActiveAt) return '오프라인'
  return relativeTime(lastActiveAt, now)
}

/** Whether the presence dot should be shown (online friends only). */
export function isOnlineDot(online: boolean): boolean {
  return online
}
