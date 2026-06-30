import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import { AuthScreen, Button, OAuthButtons, PasswordToggle, Wordmark } from '../shared/ui'
import { getApiErrorMessage, useLogin, useOauth } from '../features/auth'
import { AppleSignInError, getAppleIdToken, isAppleCancel } from '../features/auth/apple'

const schema = z.object({
  email: z.string().min(1, '이메일을 입력해 주세요').email('올바른 이메일 형식이 아니에요'),
  password: z.string().min(1, '비밀번호를 입력해 주세요'),
})

type FormValues = z.infer<typeof schema>

/** Shared style for the clean, borderless-feel filled auth inputs. */
const fieldShell: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  height: 54,
  padding: '0 16px',
  borderRadius: 14,
  background: '#FFFFFF',
  border: '1.5px solid #E7ECF3',
}

const inputStyle: React.CSSProperties = {
  flex: 1,
  minWidth: 0,
  background: 'transparent',
  border: 'none',
  outline: 'none',
  fontSize: 16,
  fontWeight: 600,
  color: 'var(--color-text)',
}

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()
  const { t } = useTranslation()
  const [showPassword, setShowPassword] = useState(false)
  const oauth = useOauth()
  const [oauthError, setOauthError] = useState<string | null>(null)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  async function handleApple() {
    setOauthError(null)
    try {
      const idToken = await getAppleIdToken()
      oauth.mutate(
        { provider: 'apple', idToken },
        {
          onSuccess: () => navigate(from, { replace: true }),
          onError: () => setOauthError('Apple 로그인에 실패했어요'),
        },
      )
    } catch (e) {
      if (isAppleCancel(e)) return
      setOauthError(
        e instanceof AppleSignInError && e.code === 'WEB_APPLE_UNCONFIGURED'
          ? '웹에서는 Apple 로그인을 준비 중이에요'
          : 'Apple 로그인에 실패했어요',
      )
    }
  }

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

  const errorText =
    errors.email?.message ??
    errors.password?.message ??
    oauthError ??
    (login.isError ? getApiErrorMessage(login.error) : '')

  return (
    <AuthScreen>
      {/* Brand */}
      <div style={{ textAlign: 'center', marginBottom: 30 }}>
        <Wordmark size={38} />
        <p style={{ marginTop: 10, fontSize: 14, fontWeight: 600, color: '#6B7890', letterSpacing: '-.2px' }}>
          {t('login.subtitle')}
        </p>
      </div>

      <form noValidate onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="focus-within:ring-2 focus-within:ring-primary/35" style={fieldShell}>
          <input
            type="email"
            inputMode="email"
            autoComplete="email"
            autoCapitalize="off"
            placeholder={t('login.emailLabel')}
            aria-label={t('login.emailLabel')}
            aria-invalid={errors.email ? true : undefined}
            style={inputStyle}
            {...register('email')}
          />
        </div>

        <div className="focus-within:ring-2 focus-within:ring-primary/35" style={fieldShell}>
          <input
            type={showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            placeholder={t('login.passwordLabel')}
            aria-label={t('login.passwordLabel')}
            aria-invalid={errors.password ? true : undefined}
            style={inputStyle}
            {...register('password')}
          />
          <PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />
        </div>

        <div style={{ textAlign: 'right', marginTop: 2 }}>
          <Link to="/reset-password" style={{ fontSize: 12.5, fontWeight: 700, color: '#7C8AA0' }}>
            {t('login.forgotPassword')}
          </Link>
        </div>

        {/* Fixed-height error row keeps the layout from jumping. */}
        <div
          role="alert"
          style={{ minHeight: 18, paddingLeft: 2, fontSize: 12.5, fontWeight: 600, color: 'var(--color-due)' }}
        >
          {errorText}
        </div>

        <Button
          type="submit"
          disabled={login.isPending}
          style={{ height: 54, borderRadius: 14, boxShadow: '0 10px 24px rgba(19,102,206,.22)' }}
        >
          {login.isPending ? t('login.submitting') : t('login.submit')}
        </Button>
      </form>

      <div className="flex items-center" style={{ gap: 12, margin: '20px 0 14px' }}>
        <div style={{ flex: 1, height: 1, background: '#E7ECF3' }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: '#AEB9CC' }}>{t('login.or')}</span>
        <div style={{ flex: 1, height: 1, background: '#E7ECF3' }} />
      </div>

      <OAuthButtons onApple={handleApple} disabled={login.isPending || oauth.isPending} />

      <div style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: '#7C8AA0', marginTop: 22 }}>
        {t('login.noAccount')}{' '}
        <Link to="/signup" style={{ color: '#1366CE', fontWeight: 800 }}>
          {t('login.signupLink')}
        </Link>
      </div>
    </AuthScreen>
  )
}
