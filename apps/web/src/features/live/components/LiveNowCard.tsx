import { useTranslation } from 'react-i18next'
import { PROFILE_COLOR_TO_AVATAR } from '../../auth/types'
import type { LiveNowEntry } from '../../tasks/types'
import { useElapsed } from '../hooks'

const AVATAR_BG: Record<'blue' | 'mint' | 'orange' | 'purple', string> = {
  blue: 'var(--avatar-blue)',
  mint: 'var(--avatar-mint)',
  orange: 'var(--avatar-orange)',
  purple: 'var(--avatar-purple)',
}

const RING_COLOR: Record<'blue' | 'mint' | 'orange' | 'purple', string> = {
  blue: '#2E86E6',
  mint: '#2BC4B0',
  orange: '#FF9D52',
  purple: '#6B5BD0',
}

type LiveNowCardProps = {
  entry: LiveNowEntry
  /** Pill label + action (참여 / 인사). */
  actionLabel?: string
  onAction?: (entry: LiveNowEntry) => void
  /** Stagger the pulse so stacked cards don't pulse in unison. */
  pulseDelay?: number
}

/** SCR-03 home "지금 활동 중" card: pulsing ring avatar + live elapsed timer. */
export function LiveNowCard({ entry, actionLabel, onAction, pulseDelay = 0 }: LiveNowCardProps) {
  const { t } = useTranslation()
  const label = actionLabel ?? t('liveNowCard.join')
  const avatarColor = PROFILE_COLOR_TO_AVATAR[entry.profileColor]
  const elapsed = useElapsed(entry.startedAt, 0, entry.status, 'since')
  const subtitlePrefix = entry.sectionTitle || entry.groupName || entry.taskTitle
  const isOrange = avatarColor === 'orange'

  return (
    <div className="flex items-center" style={{ gap: 14 }}>
      <div style={{ position: 'relative', width: 52, height: 52, flex: 'none' }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${RING_COLOR[avatarColor]}`,
            animation: `tdlPulse 2s ${pulseDelay}s infinite`,
          }}
        />
        <div
          className="flex items-center justify-center text-white"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            background: AVATAR_BG[avatarColor],
            fontWeight: 800,
            fontSize: 18,
          }}
        >
          {(entry.nickname || '?').charAt(0)}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-text)' }}>
          {t('liveNowCard.doing', { nickname: entry.nickname, taskTitle: entry.taskTitle })}
        </div>
        <div className="truncate" style={{ fontSize: 12.5, fontWeight: 600, color: '#8B98AD' }}>
          {subtitlePrefix} · {elapsed}
        </div>
      </div>
      {onAction && (
        <button
          type="button"
          onClick={() => onAction(entry)}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
          style={{
            flex: 'none',
            padding: '9px 16px',
            borderRadius: 14,
            background: isOrange ? '#FFF1E6' : '#E2F8F4',
            color: isOrange ? '#E07B2E' : '#159B89',
            fontSize: 12.5,
            fontWeight: 800,
          }}
        >
          {label}
        </button>
      )}
    </div>
  )
}
