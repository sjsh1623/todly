import { useMutation } from '@tanstack/react-query'
import * as authApi from './api'
import { useAuthStore } from './store'
import type { AuthResponse, LoginPayload, SignupPayload } from './types'

/** Exchange a provider id token (Apple / Google) for a todly session. */
export function useOauth() {
  const login = useAuthStore((s) => s.login)
  return useMutation<AuthResponse, unknown, { provider: string; idToken: string }>({
    mutationFn: ({ provider, idToken }) => authApi.oauth(provider, idToken),
    onSuccess: (data) => {
      login({ accessToken: data.accessToken, refreshToken: data.refreshToken }, data.user)
    },
  })
}

export function useLogin() {
  const login = useAuthStore((s) => s.login)
  return useMutation<AuthResponse, unknown, LoginPayload>({
    mutationFn: authApi.login,
    onSuccess: (data) => {
      login({ accessToken: data.accessToken, refreshToken: data.refreshToken }, data.user)
    },
  })
}

export function useSignup() {
  const login = useAuthStore((s) => s.login)
  return useMutation<AuthResponse, unknown, SignupPayload>({
    mutationFn: authApi.signup,
    onSuccess: (data) => {
      login({ accessToken: data.accessToken, refreshToken: data.refreshToken }, data.user)
    },
  })
}

export function useLogout() {
  const refreshToken = useAuthStore((s) => s.refreshToken)
  const logoutLocal = useAuthStore((s) => s.logout)
  return useMutation({
    mutationFn: async () => {
      if (refreshToken) {
        try {
          await authApi.logout(refreshToken)
        } catch {
          // Ignore server errors on logout; we clear locally regardless.
        }
      }
    },
    onSettled: () => logoutLocal(),
  })
}
