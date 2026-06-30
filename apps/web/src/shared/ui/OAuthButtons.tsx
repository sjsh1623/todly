import { useTranslation } from 'react-i18next'

type OAuthButtonsProps = {
  onApple?: () => void
  onGoogle?: () => void
  disabled?: boolean
}

export function OAuthButtons({ onApple, onGoogle, disabled }: OAuthButtonsProps) {
  const { t } = useTranslation()
  return (
    <div className="flex flex-col" style={{ gap: 11 }}>
      <button
        type="button"
        onClick={onApple}
        disabled={disabled}
        className="flex items-center justify-center gap-2.5 transition-opacity active:opacity-80 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        style={{ height: 52, borderRadius: 16, background: '#14233A', color: '#fff', fontSize: 14.5, fontWeight: 700 }}
      >
        <AppleLogo />
        {t('oauth.continueWith', { provider: 'Apple' })}
      </button>
      <button
        type="button"
        onClick={onGoogle}
        disabled={disabled}
        className="flex items-center justify-center gap-2.5 transition-opacity active:opacity-80 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        style={{
          height: 52,
          borderRadius: 16,
          background: '#fff',
          border: '1.5px solid #E6ECF4',
          color: 'var(--color-text)',
          fontSize: 14.5,
          fontWeight: 700,
        }}
      >
        <GoogleLogo />
        {t('oauth.continueWith', { provider: 'Google' })}
      </button>
    </div>
  )
}

/** Apple logo glyph, tinted white for the dark Apple button. */
function AppleLogo() {
  return (
    <svg width="16" height="19" viewBox="0 0 18 20" fill="#fff" aria-hidden="true" style={{ marginTop: -2 }}>
      <path d="M14.94 10.6c-.03-2.62 2.14-3.88 2.24-3.94-1.22-1.78-3.12-2.03-3.79-2.05-1.61-.16-3.15.95-3.97.95-.83 0-2.09-.93-3.45-.9-1.77.03-3.41 1.03-4.32 2.6-1.86 3.21-.47 7.94 1.32 10.55.88 1.27 1.92 2.69 3.28 2.64 1.32-.05 1.81-.84 3.4-.84 1.59 0 2.04.84 3.43.81 1.42-.02 2.32-1.28 3.18-2.55 1-1.46 1.41-2.87 1.43-2.95-.03-.01-2.74-1.04-2.77-4.12zM12.4 2.7c.71-.86 1.19-2.07 1.06-3.27-1.02.04-2.27.68-3 1.54-.65.76-1.23 1.99-1.07 3.16 1.14.09 2.3-.58 3.01-1.43z" />
    </svg>
  )
}

/** Full-color Google "G" mark. */
function GoogleLogo() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M22.5 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h5.92c-.26 1.38-1.04 2.55-2.21 3.34v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.35z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z" />
    </svg>
  )
}
