import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { useTranslation } from 'react-i18next'
import {
  Avatar,
  AuthScreen,
  Button,
  ColorPicker,
  PasswordToggle,
  TextField,
  Wordmark,
} from '../shared/ui'
import { getApiErrorMessage, useSignup } from '../features/auth'
import { PROFILE_COLOR_TO_AVATAR, type ProfileColor } from '../features/auth/types'
import { checkUsername } from '../features/auth/api'
import { getPasswordStrength } from '../features/auth/password'
import { useDebouncedValue } from '../shared/lib/useDebouncedValue'

const NICKNAME_MAX = 12

type UsernameState = 'idle' | 'checking' | 'available' | 'taken' | 'error'

export default function Signup() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const signup = useSignup()
  const [showPassword, setShowPassword] = useState(false)
  const [usernameState, setUsernameState] = useState<UsernameState>('idle')

  const schema = z.object({
    nickname: z
      .string()
      .min(1, t('signup.nicknameRequired'))
      .max(NICKNAME_MAX, t('signup.nicknameMax', { max: NICKNAME_MAX })),
    username: z
      .string()
      .min(3, t('signup.usernameMin'))
      .max(20, t('signup.usernameMax'))
      .regex(/^[a-z0-9_]+$/, t('signup.usernamePattern')),
    email: z.string().min(1, t('signup.emailRequired')).email(t('signup.emailInvalid')),
    password: z.string().min(8, t('signup.passwordMin')),
    profileColor: z.enum(['blue', 'green', 'orange', 'purple']),
  })

  type FormValues = z.infer<typeof schema>

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: 'onChange',
    defaultValues: {
      nickname: '',
      username: '',
      email: '',
      password: '',
      profileColor: 'blue',
    },
  })

  const nickname = watch('nickname')
  const username = watch('username')
  const password = watch('password')
  const profileColor = watch('profileColor') as ProfileColor

  const avatarInitial = nickname.trim().charAt(0) || '?'
  const strength = getPasswordStrength(password)
  const debouncedUsername = useDebouncedValue(username, 450)

  // Live username availability (only when format is valid).
  useEffect(() => {
    const valid = /^[a-z0-9_]{3,20}$/.test(debouncedUsername)
    if (!valid) {
      setUsernameState('idle')
      return
    }
    let cancelled = false
    setUsernameState('checking')
    checkUsername(debouncedUsername)
      .then((available) => {
        if (!cancelled) setUsernameState(available ? 'available' : 'taken')
      })
      .catch(() => {
        if (!cancelled) setUsernameState('error')
      })
    return () => {
      cancelled = true
    }
  }, [debouncedUsername])

  const onSubmit = handleSubmit((values) => {
    if (usernameState === 'taken') return
    signup.mutate(values, { onSuccess: () => navigate('/', { replace: true }) })
  })

  const usernameHint = (() => {
    switch (usernameState) {
      case 'checking':
        return <span style={{ color: '#9AA7BC' }}>{t('signup.usernameChecking')}</span>
      case 'available':
        return <span style={{ color: '#46D38A' }}>{t('signup.usernameAvailable')}</span>
      case 'taken':
        return <span style={{ color: 'var(--color-due)' }}>{t('signup.usernameTaken')}</span>
      case 'error':
        return <span style={{ color: 'var(--color-overdue)' }}>{t('signup.usernameCheckFailed')}</span>
      default:
        return undefined
    }
  })()

  return (
    <AuthScreen>
      <form noValidate onSubmit={onSubmit} className="relative flex flex-col" style={{ padding: '14px 26px 32px' }}>
        {/* Header: back arrow + centered wordmark */}
        <div className="relative flex items-center" style={{ height: 40, marginBottom: 24 }}>
          <Link
            to="/login"
            aria-label={t('signup.back')}
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

        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-.6px' }}>
          {t('signup.title')}
        </h1>
        <p style={{ fontSize: 14, fontWeight: 600, color: '#7C8AA0', marginTop: 6, marginBottom: 28 }}>
          {t('signup.subtitle')}
        </p>

        {/* Avatar preview + color picker */}
        <div className="flex items-center" style={{ gap: 16, marginBottom: 26 }}>
          <Avatar initial={avatarInitial} color={PROFILE_COLOR_TO_AVATAR[profileColor]} size={66} gradient />
          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: '#7C8AA0', marginBottom: 9 }}>{t('signup.profileColor')}</div>
            <Controller
              control={control}
              name="profileColor"
              render={({ field }) => <ColorPicker value={field.value} onChange={field.onChange} />}
            />
          </div>
        </div>

        <TextField
          label={t('signup.nicknameLabel')}
          placeholder={t('signup.nicknamePlaceholder')}
          maxLength={NICKNAME_MAX}
          autoComplete="nickname"
          error={errors.nickname?.message}
          className="mb-[15px]"
          labelAccessory={
            <span style={{ fontSize: 12, fontWeight: 600, color: '#AEB9CC' }}>
              {nickname.length}/{NICKNAME_MAX}
            </span>
          }
          {...register('nickname')}
        />

        <TextField
          label={t('signup.usernameLabel')}
          placeholder="username"
          inputMode="text"
          autoCapitalize="none"
          autoComplete="username"
          error={errors.username?.message}
          hint={errors.username ? undefined : usernameHint}
          className="mb-[15px]"
          {...register('username')}
        />

        <TextField
          label={t('signup.emailLabel')}
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@email.com"
          error={errors.email?.message}
          className="mb-[15px]"
          {...register('email')}
        />

        <TextField
          label={t('signup.passwordLabel')}
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="••••••"
          error={errors.password?.message}
          className="mb-[22px]"
          labelAccessory={
            password.length > 0 ? (
              <span style={{ fontSize: 12, fontWeight: 700, color: strength.color }}>{strength.label}</span>
            ) : undefined
          }
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          {...register('password')}
        />

        {signup.isError && (
          <p role="alert" style={{ marginBottom: 14, fontSize: 13, fontWeight: 600, color: 'var(--color-due)' }}>
            {getApiErrorMessage(signup.error)}
          </p>
        )}

        <Button
          type="submit"
          disabled={signup.isPending || usernameState === 'taken'}
          style={{ boxShadow: '0 10px 24px rgba(19,102,206,.26)', marginBottom: 14 }}
        >
          {signup.isPending ? t('signup.submitting') : t('signup.submit')}
        </Button>

        <p style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 500, color: '#9AA7BC', lineHeight: 1.6 }}>
          {t('signup.termsPrefix')} <span style={{ color: '#7C8AA0', fontWeight: 700 }}>{t('signup.termsOfService')}</span>
          {t('signup.termsConjunction')}{' '}
          <span style={{ color: '#7C8AA0', fontWeight: 700 }}>{t('signup.privacyPolicy')}</span>
          {t('signup.termsSuffix')}
          <br />
          {t('signup.termsAgree')}
        </p>

        <div style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: '#7C8AA0', padding: '20px 0 30px' }}>
          {t('signup.haveAccount')}{' '}
          <Link to="/login" style={{ color: '#1366CE', fontWeight: 800 }}>
            {t('signup.loginLink')}
          </Link>
        </div>
      </form>
    </AuthScreen>
  )
}
