// Type augmentation for nuxt-auth-utils. Defines what shape `user` has
// inside session helpers (setUserSession / getUserSession). Only fields
// safe to keep in a signed cookie should live here — never password_hash.
declare module '#auth-utils' {
  interface User {
    id: string
    email: string
  }
  // No additional non-encrypted fields beyond `user` for now.
  interface UserSession {}
  // No encrypted-at-rest data for now.
  interface SecureSessionData {}
}

export {}
