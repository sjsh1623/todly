import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { AuthScreen, Button, TextField, Wordmark } from '../shared/ui'
import { requestPasswordReset } from '../features/auth/api'

export default function ResetPassword() {
  const { t } = useTranslation()
  const [sent, setSent] = useState(false)

  const schema = z.object({
    email: z.string().min(1, t('resetPassword.emailRequired')).email(t('resetPassword.emailInvalid')),
  })

  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await requestPasswordReset(values.email)
    } catch {
      // Backend may not implement this yet — show the confirmation regardless
      // so we never leak which emails exist.
    } finally {
      setSent(true)
    }
  })

  return (
    <AuthScreen gradientHeader>
      <form noValidate onSubmit={onSubmit} className="relative flex flex-col" style={{ padding: '24px 26px 32px' }}>
        <div className="relative flex items-center" style={{ height: 40, marginBottom: 24 }}>
          <Link
            to="/login"
            aria-label={t('resetPassword.back')}
            className="flex items-center justify-center focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50"
            style={{ width: 40, height: 40, borderRadius: 14, background: '#fff', boxShadow: '0 4px 12px rgba(20,50,90,.06)' }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#14233A" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 5l-7 7 7 7" />
            </svg>
          </Link>
          <div className="absolute left-0 right-0 text-center pointer-events-none">
            <Wordmark size={22} />
          </div>
        </div>

        <div className="flex flex-col" style={{ marginTop: 24, marginBottom: 28 }}>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-.6px' }}>
            {t('resetPassword.title')}
          </h1>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#7C8AA0', marginTop: 6 }}>
            {t('resetPassword.subtitle')}
          </p>
        </div>

        {sent ? (
          <div
            role="status"
            style={{
              background: '#fff',
              border: '1.5px solid #E6ECF4',
              borderRadius: 16,
              padding: 18,
              boxShadow: '0 4px 12px rgba(20,50,90,.04)',
              fontSize: 14,
              fontWeight: 600,
              color: 'var(--color-text)',
              lineHeight: 1.6,
            }}
          >
            {t('resetPassword.sentLine1')}
            <br />
            {t('resetPassword.sentLine2')}
          </div>
        ) : (
          <>
            <TextField
              label={t('resetPassword.emailLabel')}
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="name@email.com"
              error={errors.email?.message}
              className="mb-5"
              {...register('email')}
            />
            <Button type="submit" disabled={isSubmitting} style={{ boxShadow: '0 10px 24px rgba(19,102,206,.26)' }}>
              {isSubmitting ? t('resetPassword.submitting') : t('resetPassword.submit')}
            </Button>
          </>
        )}

        <div style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: '#7C8AA0', padding: '24px 0 30px' }}>
          {t('resetPassword.rememberPassword')}{' '}
          <Link to="/login" style={{ color: '#1366CE', fontWeight: 800 }}>
            {t('resetPassword.loginLink')}
          </Link>
        </div>
      </form>
    </AuthScreen>
  )
}
