import { useTranslation } from 'react-i18next'

type PasswordToggleProps = {
  visible: boolean
  onToggle: () => void
}

/** Eye / eye-off button used to reveal password fields. */
export function PasswordToggle({ visible, onToggle }: PasswordToggleProps) {
  const { t } = useTranslation()
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={visible ? t('passwordToggle.hide') : t('passwordToggle.show')}
      aria-pressed={visible}
      className="flex-none rounded-md p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
    >
      {visible ? (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#AEB9CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 12s3.5-6.5 10-6.5S22 12 22 12s-3.5 6.5-10 6.5S2 12 2 12z" />
          <circle cx="12" cy="12" r="2.5" />
        </svg>
      ) : (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#AEB9CC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19.5C5.5 19.5 2 12 2 12a18.5 18.5 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4.5c6.5 0 10 7.5 10 7.5a18.5 18.5 0 0 1-2.16 3.19" />
          <path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
          <line x1="2" y1="2" x2="22" y2="22" />
        </svg>
      )}
    </button>
  )
}
