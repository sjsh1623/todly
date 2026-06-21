import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { PushHeader, StatusBar, useToast } from '../shared/ui'
import {
  useNotificationSettings,
  useUpdateNotificationSettings,
} from '../features/notifications'
import type { NotificationSettings as Settings } from '../features/notifications'
import { enablePush, isNativePush, webPushSupported } from '../features/push'

type Row = {
  key: keyof Pick<Settings, 'pushLive' | 'pushDue' | 'pushComment' | 'pushAssigned'>
  labelKey: string
  descKey: string
}

// SCR-14 rows mapped to the available settings flags.
const ROWS: Row[] = [
  { key: 'pushLive', labelKey: 'notificationSettings.pushLiveLabel', descKey: 'notificationSettings.pushLiveDesc' },
  { key: 'pushDue', labelKey: 'notificationSettings.pushDueLabel', descKey: 'notificationSettings.pushDueDesc' },
  { key: 'pushComment', labelKey: 'notificationSettings.pushCommentLabel', descKey: 'notificationSettings.pushCommentDesc' },
  { key: 'pushAssigned', labelKey: 'notificationSettings.pushAssignedLabel', descKey: 'notificationSettings.pushAssignedDesc' },
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
  const toast = useToast()
  const { t } = useTranslation()
  const { data: settings, isLoading } = useNotificationSettings()
  const update = useUpdateNotificationSettings()

  // Push opt-in (OS/browser permission + token registration).
  const pushAvailable = isNativePush() || webPushSupported()
  const [granted, setGranted] = useState(
    typeof Notification !== 'undefined' && Notification.permission === 'granted',
  )
  const [enabling, setEnabling] = useState(false)

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setGranted(Notification.permission === 'granted')
    }
  }, [])

  const handleEnablePush = async () => {
    setEnabling(true)
    try {
      const ok = await enablePush()
      setGranted(ok)
      toast[ok ? 'success' : 'error'](
        ok ? t('notificationSettings.pushEnabledToast') : t('notificationSettings.pushPermissionToast'),
      )
    } finally {
      setEnabling(false)
    }
  }

  const toggle = (key: Row['key']) => {
    if (!settings) return
    update.mutate({ [key]: !settings[key] } as Partial<Settings>)
  }

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--color-bg-2)' }}>
      <StatusBar />
      <PushHeader title={t('notificationSettings.title')} onBack={() => navigate(-1)} />

      <div style={{ padding: '8px 22px 24px' }}>
        {pushAvailable && (
          <div
            className="flex items-center justify-between"
            style={{ background: '#fff', borderRadius: 18, padding: '15px 18px', marginBottom: 16, gap: 12, boxShadow: '0 6px 20px rgba(17,40,86,.06)' }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{t('notificationSettings.devicePushLabel')}</div>
              <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-subtle)', marginTop: 2 }}>
                {granted ? t('notificationSettings.devicePushOn') : t('notificationSettings.devicePushHint')}
              </div>
            </div>
            <button
              type="button"
              onClick={handleEnablePush}
              disabled={enabling || granted}
              style={{
                flex: 'none',
                padding: '10px 16px',
                borderRadius: 12,
                background: granted ? '#E6F0FB' : '#1366CE',
                color: granted ? '#1366CE' : '#fff',
                fontSize: 13,
                fontWeight: 800,
                opacity: enabling ? 0.6 : 1,
              }}
            >
              {granted ? t('notificationSettings.devicePushEnabled') : enabling ? t('notificationSettings.devicePushEnabling') : t('notificationSettings.devicePushEnable')}
            </button>
          </div>
        )}

        <div style={{ fontSize: 13, fontWeight: 800, color: '#7C8AA0', margin: '0 0 11px 4px' }}>{t('notificationSettings.sectionLabel')}</div>

        {isLoading || !settings ? (
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-text-subtle)', padding: '16px 2px' }}>{t('notificationSettings.loading')}</div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 22, padding: '2px 18px', boxShadow: '0 6px 20px rgba(17,40,86,.06)' }}>
            {ROWS.map((row, i) => (
              <div
                key={row.key}
                className="flex items-center justify-between"
                style={{ padding: '15px 0', gap: 12, borderBottom: i === ROWS.length - 1 ? 'none' : '1px solid #F0F3F8' }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: 'var(--color-text)' }}>{t(row.labelKey)}</div>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-text-subtle)', marginTop: 2 }}>{t(row.descKey)}</div>
                </div>
                <Toggle on={Boolean(settings[row.key])} onClick={() => toggle(row.key)} label={t(row.labelKey)} />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
