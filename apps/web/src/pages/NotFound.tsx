import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { Wordmark } from '../shared/ui'

/**
 * Friendly catch-all for unmatched routes. Without this, React Router renders
 * its raw "Unexpected Application Error! 404 Not Found" dev screen (also the
 * only English string a Korean user would ever see).
 */
export default function NotFound() {
  const { t } = useTranslation()
  return (
    <div className="min-h-screen bg-bg flex justify-center">
      <div
        className="relative w-full max-w-[420px] min-h-screen flex flex-col items-center justify-center text-center"
        style={{ padding: '24px 26px', gap: 14 }}
      >
        <Wordmark size={34} />
        <div style={{ fontSize: 64, fontWeight: 800, color: 'var(--color-primary, #2E86E6)', letterSpacing: '-1px' }}>404</div>
        <h1 style={{ fontSize: 20, fontWeight: 800, color: 'var(--color-text)' }}>{t('notFound.heading')}</h1>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#7C8AA0', lineHeight: 1.6 }}>
          {t('notFound.body1')}
          <br />
          {t('notFound.body2')}
        </p>
        <Link
          to="/"
          style={{
            marginTop: 8,
            padding: '13px 28px',
            borderRadius: 16,
            background: 'var(--color-primary-strong, #1366CE)',
            color: '#fff',
            fontSize: 15,
            fontWeight: 800,
            boxShadow: '0 10px 24px rgba(19,102,206,.26)',
          }}
        >
          {t('notFound.goHome')}
        </Link>
      </div>
    </div>
  )
}
