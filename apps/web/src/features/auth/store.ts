import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { AuthTokens, User } from './types'

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated'

type AuthState = {
  accessToken: string | null
  refreshToken: string | null
  user: User | null
  status: AuthStatus
}

type AuthActions = {
  /** Sets full auth state after a successful login/signup. */
  login: (tokens: AuthTokens, user: User) => void
  /** Updates only tokens (used by the refresh flow). */
  setTokens: (tokens: AuthTokens) => void
  setUser: (user: User) => void
  setStatus: (status: AuthStatus) => void
  /** Clears all auth state. */
  logout: () => void
}

export const useAuthStore = create<AuthState & AuthActions>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,
      status: 'idle',

      login: (tokens, user) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user,
          status: 'authenticated',
        }),

      setTokens: (tokens) =>
        set({
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
        }),

      setUser: (user) => set({ user }),

      setStatus: (status) => set({ status }),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
          status: 'unauthenticated',
        }),
    }),
    {
      name: 'todly-auth',
      // Only the refresh token + user survive a reload; the access token is
      // re-minted via /auth/refresh on bootstrap.
      partialize: (state) => ({
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
)

/** Non-reactive accessor for use inside axios interceptors. */
export const authStore = useAuthStore
