import { createContext, useCallback, useContext, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'

export type ToastTone = 'success' | 'error' | 'info'

type ToastItem = {
  id: number
  message: string
  tone: ToastTone
}

type ToastContextValue = {
  /** Show a toast. Returns its id. */
  show: (message: string, tone?: ToastTone) => number
  success: (message: string) => number
  error: (message: string) => number
  info: (message: string) => number
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const TONE_STYLE: Record<ToastTone, { bg: string; icon: ReactNode }> = {
  success: {
    bg: '#159B89',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round">
        <path d="M5 12.5l4.5 4.5L19 6.5" />
      </svg>
    ),
  },
  error: {
    bg: '#E0584A',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 8v5M12 16.5v.5" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
  info: {
    bg: '#1366CE',
    icon: (
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 11v5M12 7.5v.5" />
        <circle cx="12" cy="12" r="9" />
      </svg>
    ),
  },
}

const AUTO_DISMISS_MS = 2800

export function ToastProvider({ children }: { children: ReactNode }) {
  const { t } = useTranslation()
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const idRef = useRef(0)
  const timers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map())

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    const timer = timers.current.get(id)
    if (timer) {
      clearTimeout(timer)
      timers.current.delete(id)
    }
  }, [])

  const show = useCallback(
    (message: string, tone: ToastTone = 'info') => {
      const id = ++idRef.current
      setToasts((prev) => [...prev, { id, message, tone }])
      const timer = setTimeout(() => dismiss(id), AUTO_DISMISS_MS)
      timers.current.set(id, timer)
      return id
    },
    [dismiss],
  )

  const value: ToastContextValue = {
    show,
    dismiss,
    success: useCallback((m: string) => show(m, 'success'), [show]),
    error: useCallback((m: string) => show(m, 'error'), [show]),
    info: useCallback((m: string) => show(m, 'info'), [show]),
  }

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="fixed left-0 right-0 z-[100] flex flex-col items-center gap-2 px-4 pointer-events-none"
        style={{ bottom: 'calc(env(safe-area-inset-bottom, 0px) + 104px)' }}
      >
        {toasts.map((toast) => {
          const tone = TONE_STYLE[toast.tone]
          return (
            <div
              key={toast.id}
              role={toast.tone === 'error' ? 'alert' : 'status'}
              aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
              className="pointer-events-auto flex items-center w-full max-w-[360px]"
              style={{
                gap: 10,
                background: tone.bg,
                color: '#fff',
                borderRadius: 14,
                padding: '12px 14px',
                boxShadow: '0 12px 30px rgba(17,40,86,.28)',
              }}
            >
              <span aria-hidden="true" className="flex-none">
                {tone.icon}
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 700, flex: 1, minWidth: 0 }}>{toast.message}</span>
              <button
                type="button"
                onClick={() => dismiss(toast.id)}
                aria-label={t('toast.dismiss')}
                className="flex-none flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-white/60 rounded-full"
                style={{ width: 24, height: 24, opacity: 0.85 }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth={2.6} strokeLinecap="round">
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within <ToastProvider>')
  return ctx
}
