import { useMutation, useQuery } from '@tanstack/react-query'
import * as settingsApi from './api'
import { useAuthStore } from '../auth/store'
import type { User } from '../auth/types'
import type {
  ChangePasswordPayload,
  ConnectedAccount,
  ContactPayload,
  UpdateMePayload,
} from './types'

/**
 * PATCH /me. On success the returned user replaces the auth store's `user` so
 * the rest of the app (Profile, theme, etc.) stays in sync.
 */
export function useUpdateMe() {
  const setUser = useAuthStore((s) => s.setUser)
  return useMutation<User, unknown, UpdateMePayload>({
    mutationFn: settingsApi.updateMe,
    onSuccess: (user) => setUser(user),
  })
}

export function useChangePassword() {
  return useMutation<void, unknown, ChangePasswordPayload>({
    mutationFn: settingsApi.changePassword,
  })
}

export function useConnectedAccounts() {
  return useQuery<ConnectedAccount[]>({
    queryKey: ['settings', 'connected-accounts'],
    queryFn: settingsApi.getConnectedAccounts,
  })
}

export function useDeleteAccount() {
  const logout = useAuthStore((s) => s.logout)
  return useMutation<void, unknown, string | undefined>({
    mutationFn: (password) => settingsApi.deleteAccount(password),
    onSuccess: () => logout(),
  })
}

export function useContact() {
  return useMutation<void, unknown, ContactPayload>({
    mutationFn: settingsApi.contact,
  })
}
