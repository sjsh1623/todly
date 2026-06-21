import type { ProfileColor } from '../auth/types'

export type GroupType = 'group' | 'couple' | 'travel' | 'list'

export type GroupRole = 'owner' | 'admin' | 'member'

export type GroupProgress = {
  percent: number
  done: number
  total: number
}

/** Member shape as returned in the group list (lighter than detail). */
export type GroupMemberSummary = {
  userId: string
  username: string
  nickname: string
  profileColor: ProfileColor
  role: GroupRole
}

/** Member shape as returned in the group detail (adds presence). */
export type GroupMemberDetail = GroupMemberSummary & {
  online: boolean
  lastSeenAt: string | null
}

/** Item returned by GET /groups. */
export type GroupListItem = {
  id: string
  name: string
  type: GroupType
  color: string
  icon: string | null
  memberCount: number
  role: GroupRole
  progress: GroupProgress
  members: GroupMemberSummary[]
}

/** Returned by GET /groups/{id} and POST /groups. */
export type GroupDetail = {
  id: string
  name: string
  type: GroupType
  color: string
  icon: string | null
  description: string | null
  ownerId: string
  role: GroupRole
  memberCount: number
  onlineCount: number
  progress: GroupProgress
  members: GroupMemberDetail[]
}

export type CreateGroupPayload = {
  name: string
  type: GroupType
  color: string
  icon?: string
  description?: string
}

export type UpdateGroupPayload = {
  name?: string
  color?: string
  type?: GroupType
  icon?: string
  description?: string
}

export type Invitation = {
  code: string
  url: string
  expiresAt: string
}

export type InvitationPreview = {
  group: {
    id: string
    name: string
    color: string
    type: GroupType
    memberCount: number
  }
  status: string
  expired: boolean
}

export type AcceptInvitationResult = {
  groupId: string
}
