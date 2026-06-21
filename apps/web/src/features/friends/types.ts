import type { ProfileColor } from '../auth/types'

/** Relationship between the current user and a searched user. */
export type FriendRelation = 'none' | 'friend' | 'incoming' | 'outgoing' | 'blocked'

/** A lightweight user reference embedded in requests. */
export type UserRef = {
  userId: string
  username: string
  nickname: string
  profileColor: ProfileColor
}

/** A result row from GET /users/search. */
export type UserSearchResult = UserRef & {
  relation: FriendRelation
  sharedGroups: number
}

/** A confirmed friend from GET /friends. */
export type Friend = UserRef & {
  online: boolean
  lastActiveAt: string | null
  sharedGroups: number
}

/** An incoming friend request. */
export type IncomingRequest = {
  id: string
  fromUser: UserRef
  createdAt: string
}

/** An outgoing friend request. */
export type OutgoingRequest = {
  id: string
  toUser: UserRef
  createdAt: string
}

/** Returned by GET /friends/requests. */
export type FriendRequests = {
  incoming: IncomingRequest[]
  outgoing: OutgoingRequest[]
}

/** Returned by POST /friends/requests — either a created request or an auto-accept. */
export type SendRequestResult =
  | { status: 'accepted' }
  | { request: OutgoingRequest }

/** Returned by POST /groups/{id}/invite-friends. */
export type InviteFriendsResult = {
  added: string[]
  skipped: string[]
}
