import type { ControlCenterPrefs } from './control-center'

declare module '#auth-utils' {
  interface User {
    id: string
    email: string
  }
  interface UserSession {
    sessionId?: string
  }
  
  interface SecureSessionData {}
}

export interface SessionUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  middleName: string | null
  avatarUrl: string | null
  jobTitle: string | null
  bio: string | null
  dismissedHints: string[]
  emailVerifiedAt: string | null
}

export interface SessionResponse {
  user: SessionUser
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  email: string
  password: string
  firstName?: string
  lastName?: string
  middleName?: string
}

export interface UserProfile {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  middleName: string | null
  avatarUrl: string | null
  jobTitle: string | null
  bio: string | null
  dismissedHints: string[]
  notificationPrefs: Record<string, boolean>
  controlCenterPrefs: ControlCenterPrefs
  changelogSeenAt: string | null
  emailVerifiedAt: string | null
  createdAt: string
  updatedAt: string
}

export interface UserProfileResponse {
  user: UserProfile
}

export interface UpdateUserProfileInput {
  notificationPrefs?: Record<string, boolean>
  controlCenterPrefs?: ControlCenterPrefs
  dismissedHints?: string[]
  firstName?: string | null
  lastName?: string | null
  middleName?: string | null
  avatarUrl?: string | null
  jobTitle?: string | null
  bio?: string | null
}