import { isAxiosError } from 'axios'
import { api } from '../../shared/lib/api'
import { useAuthStore } from '../auth/store'
import i18n from '../../shared/i18n/i18n'
import type { ApiError } from '../auth/types'
import type {
  AcceptInvitationResult,
  CreateGroupPayload,
  GroupDetail,
  GroupListItem,
  Invitation,
  InvitationPreview,
  UpdateGroupPayload,
} from './types'

export async function listGroups(): Promise<GroupListItem[]> {
  const { data } = await api.get<GroupListItem[]>('/groups')
  return data
}

export async function getGroup(id: string): Promise<GroupDetail> {
  const { data } = await api.get<GroupDetail>(`/groups/${id}`)
  return data
}

export async function createGroup(payload: CreateGroupPayload): Promise<GroupDetail> {
  const { data } = await api.post<GroupDetail>('/groups', payload)
  return data
}

export async function updateGroup(id: string, payload: UpdateGroupPayload): Promise<GroupDetail> {
  const { data } = await api.patch<GroupDetail>(`/groups/${id}`, payload)
  return data
}

export async function deleteGroup(id: string): Promise<void> {
  await api.delete(`/groups/${id}`)
}

export async function leaveGroup(id: string): Promise<void> {
  // Self-leave is the membership-removal endpoint with the current user's id
  // (DELETE /groups/{id}/members/{userId}, per the API contract).
  const userId = useAuthStore.getState().user?.id
  if (!userId) throw new Error('Not authenticated')
  await api.delete(`/groups/${id}/members/${userId}`)
}

export async function createInvite(id: string, expiresInHours?: number): Promise<Invitation> {
  const { data } = await api.post<Invitation>(`/groups/${id}/invitations`, { expiresInHours })
  return data
}

export async function getInvitePreview(code: string): Promise<InvitationPreview> {
  const { data } = await api.get<InvitationPreview>(`/invitations/${code}`)
  return data
}

export async function acceptInvite(code: string): Promise<AcceptInvitationResult> {
  const { data } = await api.post<AcceptInvitationResult>(`/invitations/${code}/accept`)
  return data
}

/** Reads the API error code from an axios error, if present. */
export function getApiErrorCode(error: unknown): string | undefined {
  if (isAxiosError<ApiError>(error)) return error.response?.data?.code
  return undefined
}

/** Maps a groups API error to a localized, user-facing message. */
export function getGroupErrorMessage(
  error: unknown,
  fallback = i18n.t('errors.generic'),
): string {
  if (isAxiosError<ApiError>(error)) {
    const code = error.response?.data?.code
    if (code) {
      const message = i18n.t(`errorGroup.${code}`, { defaultValue: '' })
      if (message) return message
    }
    if (error.response?.data?.message) return error.response.data.message
  }
  return fallback
}
