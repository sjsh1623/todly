import { isAxiosError } from 'axios'
import { api } from '../../shared/lib/api'
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

const ERROR_MESSAGES: Record<string, string> = {
  USER_NOT_FOUND: '해당 아이디의 사용자를 찾을 수 없어요',
  ALREADY_FRIENDS: '이미 친구예요',
  REQUEST_EXISTS: '이미 친구 요청을 보냈어요',
  BLOCKED: '차단된 사용자예요',
}

/** Maps a friends API error to a user-facing Korean message. */
export function getFriendErrorMessage(
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
