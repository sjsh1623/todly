import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { I18nextProvider } from 'react-i18next'
import i18n from '../shared/i18n/i18n'

// Mock the auth API so a valid submit never hits the network.
const login = vi.fn().mockResolvedValue({
  accessToken: 't',
  refreshToken: 'r',
  user: { id: '1', username: 'u', nickname: 'n', profileColor: 'BLUE' },
})
vi.mock('../features/auth/api', async (importActual) => {
  const actual = await importActual<typeof import('../features/auth/api')>()
  return {
    ...actual,
    login: (...args: unknown[]) => login(...args),
  }
})

import Login from './Login'

function renderLogin() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <I18nextProvider i18n={i18n}>
      <QueryClientProvider client={qc}>
        <MemoryRouter initialEntries={['/login']}>
          <Login />
        </MemoryRouter>
      </QueryClientProvider>
    </I18nextProvider>,
  )
}

function submit() {
  fireEvent.submit(screen.getByRole('button', { name: '로그인' }).closest('form')!)
}
function fill(email: string, password: string) {
  fireEvent.change(screen.getByPlaceholderText('name@email.com'), { target: { value: email } })
  fireEvent.change(screen.getByPlaceholderText('••••••••'), { target: { value: password } })
}

describe('Login form validation', () => {
  beforeEach(() => login.mockClear())

  it('renders the todly wordmark and 로그인 button', () => {
    renderLogin()
    expect(screen.getByRole('button', { name: '로그인' })).toBeInTheDocument()
    expect(screen.getAllByText('todly').length).toBeGreaterThan(0)
  })

  it('shows a zod error when fields are empty on submit', async () => {
    renderLogin()
    submit()
    expect(await screen.findByText('이메일을 입력해 주세요')).toBeInTheDocument()
    expect(screen.getByText('비밀번호를 입력해 주세요')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('shows an email-format error for an invalid email', async () => {
    renderLogin()
    fill('not-an-email', 'secret123')
    submit()
    expect(await screen.findByText('올바른 이메일 형식이 아니에요')).toBeInTheDocument()
    expect(login).not.toHaveBeenCalled()
  })

  it('calls the login API with valid input', async () => {
    renderLogin()
    fill('a@b.com', 'secret123')
    submit()
    await waitFor(() => expect(login).toHaveBeenCalled())
    expect(login.mock.calls[0][0]).toEqual({ email: 'a@b.com', password: 'secret123' })
  })
})
