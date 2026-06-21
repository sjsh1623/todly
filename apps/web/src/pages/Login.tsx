import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { AuthScreen, Button, OAuthButtons, PasswordToggle, TextField, Wordmark } from '../shared/ui'
import { getApiErrorMessage, useLogin } from '../features/auth'

export default function Login() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()
  const [showPassword, setShowPassword] = useState(false)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const schema = z.object({
    email: z.string().min(1, t('login.emailRequired')).email(t('login.emailInvalid')),
    password: z.string().min(1, t('login.passwordRequired')),
  })

  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = handleSubmit((values) => {
    login.mutate(values, { onSuccess: () => navigate(from, { replace: true }) })
  })

  return (
    <AuthScreen gradientHeader>
      <form noValidate onSubmit={onSubmit} className="relative flex flex-col" style={{ padding: '24px 26px 32px' }}>
        <div className="flex flex-col items-center text-center" style={{ marginTop: 54, marginBottom: 38 }}>
          <div style={{ marginBottom: 20 }}>
            <Wordmark size={40} />
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-.6px' }}>
            {t('login.title')}
          </h1>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#7C8AA0', marginTop: 6 }}>
            {t('login.subtitle')}
          </p>
        </div>

        <TextField
          label={t('login.emailLabel')}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@email.com"
          error={errors.email?.message}
          className="mb-4"
          {...register('email')}
        />

        <TextField
          label={t('login.passwordLabel')}
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          {...register('password')}
        />

        <div style={{ textAlign: 'right', marginTop: 14, marginBottom: 20 }}>
          <Link to="/reset-password" style={{ fontSize: 12.5, fontWeight: 700, color: '#7C8AA0' }}>
            {t('login.forgotPassword')}
          </Link>
        </div>

        {login.isError && (
          <p role="alert" style={{ marginBottom: 14, fontSize: 13, fontWeight: 600, color: 'var(--color-due)' }}>
            {getApiErrorMessage(login.error)}
          </p>
        )}

        <Button
          type="submit"
          disabled={login.isPending}
          style={{ boxShadow: '0 10px 24px rgba(19,102,206,.26)', marginBottom: 22 }}
        >
          {login.isPending ? t('login.submitting') : t('login.submit')}
        </Button>

        <div className="flex items-center" style={{ gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#E0E6EF' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#AEB9CC' }}>{t('login.or')}</span>
          <div style={{ flex: 1, height: 1, background: '#E0E6EF' }} />
        </div>

        <OAuthButtons disabled={login.isPending} />

        <div style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: '#7C8AA0', padding: '24px 0 30px' }}>
          {t('login.noAccount')}{' '}
          <Link to="/signup" style={{ color: '#1366CE', fontWeight: 800 }}>
            {t('login.signupLink')}
          </Link>
        </div>
      </form>
    </AuthScreen>
  )
}
