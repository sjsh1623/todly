import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { AuthScreen, Button, OAuthButtons, PasswordToggle, TextField, Wordmark } from '../shared/ui'
import { getApiErrorMessage, useLogin } from '../features/auth'

const schema = z.object({
  email: z.string().min(1, '이메일을 입력해 주세요').email('올바른 이메일 형식이 아니에요'),
  password: z.string().min(1, '비밀번호를 입력해 주세요'),
})

type FormValues = z.infer<typeof schema>

export default function Login() {
  const navigate = useNavigate()
  const location = useLocation()
  const login = useLogin()
  const [showPassword, setShowPassword] = useState(false)
  const from = (location.state as { from?: string } | null)?.from ?? '/'

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
            다시 오신 걸 환영해요
          </h1>
          <p style={{ fontSize: 14, fontWeight: 600, color: '#7C8AA0', marginTop: 6 }}>
            함께 살아가는 하루를 이어가요
          </p>
        </div>

        <TextField
          label="이메일"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder="name@email.com"
          error={errors.email?.message}
          className="mb-4"
          {...register('email')}
        />

        <TextField
          label="비밀번호"
          type={showPassword ? 'text' : 'password'}
          autoComplete="current-password"
          placeholder="••••••••"
          error={errors.password?.message}
          trailing={<PasswordToggle visible={showPassword} onToggle={() => setShowPassword((v) => !v)} />}
          {...register('password')}
        />

        <div style={{ textAlign: 'right', marginTop: 14, marginBottom: 20 }}>
          <Link to="/reset-password" style={{ fontSize: 12.5, fontWeight: 700, color: '#7C8AA0' }}>
            비밀번호를 잊으셨나요?
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
          {login.isPending ? '로그인 중…' : '로그인'}
        </Button>

        <div className="flex items-center" style={{ gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 1, background: '#E0E6EF' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: '#AEB9CC' }}>또는</span>
          <div style={{ flex: 1, height: 1, background: '#E0E6EF' }} />
        </div>

        <OAuthButtons disabled={login.isPending} />

        <div style={{ textAlign: 'center', fontSize: 13.5, fontWeight: 600, color: '#7C8AA0', padding: '24px 0 30px' }}>
          계정이 없으신가요?{' '}
          <Link to="/signup" style={{ color: '#1366CE', fontWeight: 800 }}>
            회원가입
          </Link>
        </div>
      </form>
    </AuthScreen>
  )
}
