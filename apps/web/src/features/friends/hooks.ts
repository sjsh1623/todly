import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useDebouncedValue } from '../../shared/lib/useDebouncedValue'
import * as friendsApi from './api'
import type {
  Friend,
  FriendRequests,
  InviteFriendsResult,
  SendRequestResult,
  UserSearchResult,
} from './types'

export const friendKeys = {
  all: ['friends'] as const,
  list: () => [...friendKeys.all, 'list'] as const,
  requests: () => [...friendKeys.all, 'requests'] as const,
  search: (q: string) => [...friendKeys.all, 'search', q] as const,
}

export function useFriends() {
  return useQuery<Friend[]>({
    queryKey: friendKeys.list(),
    queryFn: friendsApi.listFriends,
  })
}

export function useFriendRequests() {
  return useQuery<FriendRequests>({
    queryKey: friendKeys.requests(),
    queryFn: friendsApi.listRequests,
  })
}

/**
 * Debounced user search. The query only runs once the trimmed term is at
 * least 1 char, so an empty box never hits the network.
 */
export function useUserSearch(q: string) {
  const debounced = useDebouncedValue(q.trim(), 350)
  return useQuery<UserSearchResult[]>({
    queryKey: friendKeys.search(debounced),
    queryFn: () => friendsApi.searchUsers(debounced),
    enabled: debounced.length > 0,
  })
}

/** Invalidate every friend-related cache after a relationship change. */
function useInvalidateFriends() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: friendKeys.all })
}

export function useSendRequest() {
  const invalidate = useInvalidateFriends()
  return useMutation<SendRequestResult, unknown, string>({
    mutationFn: friendsApi.sendRequest,
    onSuccess: invalidate,
  })
}

export function useAcceptRequest() {
  const invalidate = useInvalidateFriends()
  return useMutation<void, unknown, string>({
    mutationFn: friendsApi.acceptRequest,
    onSuccess: invalidate,
  })
}

export function useDeclineRequest() {
  const invalidate = useInvalidateFriends()
  return useMutation<void, unknown, string>({
    mutationFn: friendsApi.declineRequest,
    onSuccess: invalidate,
  })
}

export function useUnfriend() {
  const invalidate = useInvalidateFriends()
  return useMutation<void, unknown, string>({
    mutationFn: friendsApi.unfriend,
    onSuccess: invalidate,
  })
}

export function useBlock() {
  const invalidate = useInvalidateFriends()
  return useMutation<void, unknown, string>({
    mutationFn: friendsApi.block,
    onSuccess: invalidate,
  })
}

export function useUnblock() {
  const invalidate = useInvalidateFriends()
  return useMutation<void, unknown, string>({
    mutationFn: friendsApi.unblock,
    onSuccess: invalidate,
  })
}

export function useInviteFriends(groupId: string) {
  const qc = useQueryClient()
  return useMutation<InviteFriendsResult, unknown, string[]>({
    mutationFn: (userIds) => friendsApi.inviteFriendsToGroup(groupId, userIds),
    onSuccess: () => {
      // Membership changed → refresh the group's caches.
      qc.invalidateQueries({ queryKey: ['groups'] })
      qc.invalidateQueries({ queryKey: friendKeys.list() })
    },
  })
}
