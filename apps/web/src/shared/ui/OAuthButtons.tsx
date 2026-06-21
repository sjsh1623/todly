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
        className="flex items-center justify-center transition-opacity active:opacity-80 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
        style={{ height: 52, borderRadius: 16, background: '#14233A', color: '#fff', fontSize: 14.5, fontWeight: 700 }}
      >
        {t('oauth.continueWith', { provider: 'Apple' })}
      </button>
      <button
        type="button"
        onClick={onGoogle}
        disabled={disabled}
        className="flex items-center justify-center transition-opacity active:opacity-80 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
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
        {t('oauth.continueWith', { provider: 'Google' })}
      </button>
    </div>
  )
}
