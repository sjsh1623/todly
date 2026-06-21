import { useNavigate } from 'react-router-dom'
import { PushHeader, StatusBar } from '../shared/ui'
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '../features/notifications'
import type { NotificationSettings as Settings } from '../features/notifications'

type Row = {
  key: keyof Pick<Settings, 'pushLive' | 'pushDue' | 'pushComment' | 'pushAssigned'>
  label: string
  desc: string
}

// SCR-14 rows mapped to the available settings flags.
const ROWS: Row[] = [
  { key: 'pushLive', label: '라이브 시작 알림', desc: '함께하는 사람이 라이브를 시작하면 알려드려요' },
  { key: 'pushDue', label: '투두 완료 알림', desc: '투두가 완료되면 알려드려요' },
  { key: 'pushComment', label: '댓글 알림', desc: '내 투두에 댓글이 달리면 알려드려요' },
  { key: 'pushAssigned', label: '친구 · 친구 요청', desc: '친구 요청과 수락을 알려드려요' },
]

function Toggle({
  on,
  onClick,
  label,
}: {
  on: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      onClick={onClick}
      className="relative focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      style={{ width: 46, height: 27, borderRadius: 14, background: on ? '#1366CE' : '#DDE3EC', flex: 'none' }}
    >
      <span
        className="absolute"
        style={{
          top: 3,
          left: on ? 22 : 3,
          width: 21,
          height: 21,
          borderRadius: '50%',
          background: '#fff',
          boxShadow: '0 2px 5px rgba(0,0,0,.18)',
          transition: 'left .15s ease',
        }}
      />
    </button>
  )
}

export default function NotificationSettings() {
  const navigate = useNavigate()
  const { data: settings, isLoading } = useNotificationSettings()
  const update = useUpdateNotificationSettings()

  const toggle = (key: Row['key']) => {
    if (!settings) return
    update.mutate({ [key]: !settings[key] } as Partial<Settings>)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <PushHeader title="알림" onBack={() => navigate(-1)} />

      <div style={{ padding: '8px 22px 24px' }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', margin: '0 0 11px 4px' }}>알림</div>

        {isLoading || !settings ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-subtle)', padding: '16px 2px' }}>불러오는 중…</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 22, padding: '2px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)' }}>
            {ROWS.map((row, i) => (
              <div
                key={row.key}
                className="flex items-center justify-between"
                style={{ padding: '15px 0', gap: 12, borderBottom: i === ROWS.length - 1 ? 'none' : '1px solid #F0F3F8' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{row.label}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-subtle)', marginTop: 2 }}>{row.desc}</div>
                </div>
                <Toggle on={Boolean(settings[row.key])} onClick={() => toggle(row.key)} label={row.label} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
