import { isAxiosError } from 'axios'
import { api } from '../../shared/lib/api'
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
  await api.post(`/groups/${id}/leave`)
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

const ERROR_MESSAGES: Record<string, string> = {
  ALREADY_MEMBER: '이미 이 그룹의 멤버예요',
  INVITATION_EXPIRED: '초대 링크가 만료되었어요',
  FORBIDDEN: '권한이 없어요',
  OWNER_MUST_DELEGATE: '방장은 다른 멤버에게 권한을 넘긴 뒤 나갈 수 있어요',
  GROUP_NOT_FOUND: '그룹을 찾을 수 없어요',
  INVITATION_NOT_FOUND: '초대 링크를 찾을 수 없어요',
}

/** Reads the API error code from an axios error, if present. */
export function getApiErrorCode(error: unknown): string | undefined {
  if (isAxiosError<ApiError>(error)) return error.response?.data?.code
  return undefined
}

/** Maps a groups API error to a user-facing Korean message. */
export function getGroupErrorMessage(
  error: unknown,
  fallback = '문제가 발생했어요. 다시 시도해 주세요',
): string {
  if (isAxiosError<ApiError>(error)) {
    const code = error.response?.data?.code
    if (code && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code]
    if (error.response?.data?.message) return error.response.data.message
  }
  return fallback
}
