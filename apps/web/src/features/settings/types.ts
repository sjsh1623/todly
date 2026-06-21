import type { ProfileColor } from '../auth/types'

/** Fields the user can change via PATCH /me. */
export type UpdateMePayload = {
  nickname?: string
  profileColor?: ProfileColor
  theme?: string
  darkMode?: boolean
  language?: string
}

export type ChangePasswordPayload = {
  currentPassword: string
  newPassword: string
}

export type ConnectedAccount = {
  provider: string
  linkedAt: string
}

export type ContactPayload = {
  subject: string
  body: string
}
