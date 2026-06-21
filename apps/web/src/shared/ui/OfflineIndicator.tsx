import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useToast } from './Toast'

/**
 * Watches the browser's online/offline state. Shows a persistent banner while
 * offline and a one-off "reconnected" toast when the network returns.
 * Mounted once near the app root (inside ToastProvider).
 */
export function OfflineIndicator() {
  const { t } = useTranslation()
  const toast = useToast()
  const [offline, setOffline] = useState(() => typeof navigator !== 'undefined' && !navigator.onLine)
  // Track whether we were ever offline so we only toast on a real recovery.
  const wasOffline = useRef(offline)

  useEffect(() => {
    const goOffline = () => {
      wasOffline.current = true
      setOffline(true)
    }
    const goOnline = () => {
      setOffline(false)
      if (wasOffline.current) {
        wasOffline.current = false
        toast.success(t('offlineIndicator.reconnected'))
      }
    }
    window.addEventListener('offline', goOffline)
    window.addEventListener('online', goOnline)
    return () => {
      window.removeEventListener('offline', goOffline)
      window.removeEventListener('online', goOnline)
    }
  }, [toast])

  if (!offline) return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed left-0 right-0 z-[90] flex items-center justify-center gap-2"
      style={{
        top: 0,
        background: '#14233A',
        color: '#fff',
        padding: '8px 16px calc(8px + env(safe-area-inset-top, 0px))',
        fontSize: 12.5,
        fontWeight: 700,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#FFB23E" strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M2 8.8a16 16 0 0 1 20 0M5 12.3a11 11 0 0 1 14 0M8.5 15.8a6 6 0 0 1 7 0" />
        <path d="M3 3l18 18" />
      </svg>
      {t('offlineIndicator.banner')}
    </div>
  )
}
