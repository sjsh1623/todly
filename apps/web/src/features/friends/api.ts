import { isAxiosError } from 'axios'
import { api } from '../../shared/lib/api'
import i18n from '../../shared/i18n/i18n'
import type { ApiError } from '../auth/types'
import type {
  Friend,
  FriendRequests,
  InviteFriendsResult,
  SendRequestResult,
  UserSearchResult,
} from './types'

export async function searchUsers(q: string): Promise<UserSearchResult[]> {
  const { data } = await api.get<UserSearchResult[]>('/users/search', { params: { q } })
  return data
}

export async function listFriends(): Promise<Friend[]> {
  const { data } = await api.get<Friend[]>('/friends')
  return data
}

export async function listRequests(): Promise<FriendRequests> {
  const { data } = await api.get<FriendRequests>('/friends/requests')
  return data
}

export async function sendRequest(username: string): Promise<SendRequestResult> {
  const { data } = await api.post<SendRequestResult>('/friends/requests', { username })
  return data
}

export async function acceptRequest(id: string): Promise<void> {
  await api.post(`/friends/requests/${id}/accept`)
}

export async function declineRequest(id: string): Promise<void> {
  await api.post(`/friends/requests/${id}/decline`)
}

export async function unfriend(userId: string): Promise<void> {
  await api.delete(`/friends/${userId}`)
}

export async function block(userId: string): Promise<void> {
  await api.post(`/friends/${userId}/block`)
}

export async function unblock(userId: string): Promise<void> {
  await api.delete(`/friends/${userId}/block`)
}

export async function inviteFriendsToGroup(
  groupId: string,
  userIds: string[],
): Promise<InviteFriendsResult> {
  const { data } = await api.post<InviteFriendsResult>(`/groups/${groupId}/invite-friends`, {
    userIds,
  })
  return data
}

/** Maps a friends API error to a localized, user-facing message. */
export function getFriendErrorMessage(
  error: unknown,
  fallback = i18n.t('errors.generic'),
): string {
  if (isAxiosError<ApiError>(error)) {
    const code = error.response?.data?.code
    if (code) {
      const message = i18n.t(`errorFriend.${code}`, { defaultValue: '' })
      if (message) return message
    }
    if (error.response?.data?.message) return error.response.data.message
  }
  return fallback
}
