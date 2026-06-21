import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import * as groupsApi from './api'
import type {
  AcceptInvitationResult,
  CreateGroupPayload,
  GroupDetail,
  GroupListItem,
  Invitation,
  InvitationPreview,
  UpdateGroupPayload,
} from './types'

export const groupKeys = {
  all: ['groups'] as const,
  lists: () => [...groupKeys.all, 'list'] as const,
  detail: (id: string) => [...groupKeys.all, 'detail', id] as const,
  invitePreview: (code: string) => ['invitations', code] as const,
}

export function useGroups(options?: { enabled?: boolean }) {
  return useQuery<GroupListItem[]>({
    queryKey: groupKeys.lists(),
    queryFn: groupsApi.listGroups,
    enabled: options?.enabled ?? true,
  })
}

export function useGroup(id: string | undefined) {
  return useQuery<GroupDetail>({
    queryKey: groupKeys.detail(id ?? ''),
    queryFn: () => groupsApi.getGroup(id as string),
    enabled: Boolean(id),
  })
}

export function useCreateGroup() {
  const qc = useQueryClient()
  return useMutation<GroupDetail, unknown, CreateGroupPayload>({
    mutationFn: groupsApi.createGroup,
    onSuccess: (group) => {
      qc.invalidateQueries({ queryKey: groupKeys.lists() })
      qc.setQueryData(groupKeys.detail(group.id), group)
    },
  })
}

export function useUpdateGroup(id: string) {
  const qc = useQueryClient()
  return useMutation<GroupDetail, unknown, UpdateGroupPayload>({
    mutationFn: (payload) => groupsApi.updateGroup(id, payload),
    onSuccess: (group) => {
      qc.setQueryData(groupKeys.detail(id), group)
      qc.invalidateQueries({ queryKey: groupKeys.lists() })
    },
  })
}

export function useDeleteGroup() {
  const qc = useQueryClient()
  return useMutation<void, unknown, string>({
    mutationFn: groupsApi.deleteGroup,
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: groupKeys.detail(id) })
      qc.invalidateQueries({ queryKey: groupKeys.lists() })
    },
  })
}

export function useLeaveGroup() {
  const qc = useQueryClient()
  return useMutation<void, unknown, string>({
    mutationFn: groupsApi.leaveGroup,
    onSuccess: (_data, id) => {
      qc.removeQueries({ queryKey: groupKeys.detail(id) })
      qc.invalidateQueries({ queryKey: groupKeys.lists() })
    },
  })
}

export function useCreateInvite(id: string) {
  return useMutation<Invitation, unknown, number | undefined>({
    mutationFn: (expiresInHours) => groupsApi.createInvite(id, expiresInHours),
  })
}

export function useInvitePreview(code: string | undefined) {
  return useQuery<InvitationPreview>({
    queryKey: groupKeys.invitePreview(code ?? ''),
    queryFn: () => groupsApi.getInvitePreview(code as string),
    enabled: Boolean(code),
    retry: false,
  })
}

export function useAcceptInvite() {
  const qc = useQueryClient()
  return useMutation<AcceptInvitationResult, unknown, string>({
    mutationFn: groupsApi.acceptInvite,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: groupKeys.lists() })
    },
  })
}
