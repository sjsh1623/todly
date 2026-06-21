export type ProfileColor = 'blue' | 'green' | 'orange' | 'purple'

export type User = {
  id: string
  username: string
  nickname: string
  email: string
  profileColor: ProfileColor
  theme: string
  darkMode: boolean
  language?: string
  avatarUrl?: string | null
}

export type AuthTokens = {
  accessToken: string
  refreshToken: string
}

export type AuthResponse = AuthTokens & {
  user: User
}

export type SignupPayload = {
  username: string
  nickname: string
  email: string
  password: string
  profileColor: ProfileColor
}

export type LoginPayload = {
  email: string
  password: string
}

export type ApiError = {
  code: string
  message: string
  details?: unknown
}

/** Maps the design's avatar swatch colors to the API profileColor enum. */
export const PROFILE_COLOR_TO_AVATAR: Record<ProfileColor, 'blue' | 'mint' | 'orange' | 'purple'> = {
  blue: 'blue',
  green: 'mint',
  orange: 'orange',
  purple: 'purple',
}
