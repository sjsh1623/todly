import i18n from '../../shared/i18n/i18n'
import { relativeTime } from '../../shared/lib/relativeTime'

/** Coarse presence bucket — drive UI logic off this, never off localized text. */
export type PresenceKind = 'active' | 'online' | 'offline'

/**
 * Classifies a friend's presence:
 *   online + active within 5 min → 'active'
 *   online (idle)               → 'online'
 *   offline                     → 'offline'
 */
export function presenceKind(
  online: boolean,
  lastActiveAt: string | null,
  now: Date = new Date(),
): PresenceKind {
  if (!online) return 'offline'
  if (lastActiveAt) {
    const diffMs = now.getTime() - new Date(lastActiveAt).getTime()
    if (!Number.isNaN(diffMs) && diffMs < 5 * 60_000) return 'active'
  }
  return 'online'
}

/**
 * Localized presence copy:
 *   active  → "지금 활동 중" / "Active now"
 *   online  → "온라인" / "Online"
 *   offline → relative time, or "오프라인" / "Offline" when never seen
 */
export function presenceText(
  online: boolean,
  lastActiveAt: string | null,
  now: Date = new Date(),
): string {
  const kind = presenceKind(online, lastActiveAt, now)
  if (kind === 'active') return i18n.t('presence.activeNow')
  if (kind === 'online') return i18n.t('presence.online')
  if (!lastActiveAt) return i18n.t('presence.offline')
  return relativeTime(lastActiveAt, now)
}

/** Whether the presence dot should be shown (online friends only). */
export function isOnlineDot(online: boolean): boolean {
  return online
}
