import { PROFILE_COLOR_TO_AVATAR } from '../../auth/types'
import { useElapsed } from '../hooks'
import type { LiveSession } from '../types'

const AVATAR_BG: Record<'blue' | 'mint' | 'orange' | 'purple', string> = {
  blue: 'var(--avatar-blue)',
  mint: 'var(--avatar-mint)',
  orange: 'var(--avatar-orange)',
  purple: 'var(--avatar-purple)',
}

const RING_COLOR: Record<'blue' | 'mint' | 'orange' | 'purple', string> = {
  blue: '#5FE3F0',
  mint: '#5FE3F0',
  orange: '#FFC58C',
  purple: '#9C8DF0',
}

type LiveBannerProps = {
  session: LiveSession
  onJoin?: (session: LiveSession) => void
}

/** SCR-04 group live banner: pulsing avatar + "라이브 · {elapsed}". */
export function LiveBanner({ session, onJoin }: LiveBannerProps) {
  const avatarColor = PROFILE_COLOR_TO_AVATAR[session.profileColor]
  const elapsed = useElapsed(session.startedAt, session.pausedSeconds, session.status, 'short')

  return (
    <div
      className="flex items-center"
      style={{
        gap: 11,
        background: '#fff',
        borderRadius: 18,
        padding: '14px 16px',
        marginBottom: 20,
        boxShadow: '0 10px 26px rgba(11,40,86,.22)',
      }}
    >
      <div style={{ position: 'relative', width: 40, height: 40, flex: 'none' }}>
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: '50%',
            border: `2px solid ${RING_COLOR[avatarColor]}`,
            animation: 'tdlPulse 2s infinite',
          }}
        />
        <div
          className="flex items-center justify-center text-white"
          style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: AVATAR_BG[avatarColor], fontWeight: 800 }}
        >
          {(session.nickname || '?').charAt(0)}
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="truncate" style={{ fontSize: 13.5, fontWeight: 800, color: 'var(--color-text)' }}>
          {session.nickname}님이 '{session.taskTitle}' 하는 중
        </div>
        <div style={{ fontSize: 11.5, fontWeight: 700, color: '#159B89' }}>
          {session.status === 'paused' ? '일시정지' : '라이브'} · {elapsed}
        </div>
      </div>
      {onJoin && (
        <button
          type="button"
          onClick={() => onJoin(session)}
          className="focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60"
          style={{ flex: 'none', padding: '8px 14px', borderRadius: 13, background: '#1366CE', color: '#fff', fontSize: 12, fontWeight: 800 }}
        >
          참여
        </button>
      )}
    </div>
  )
}
