declare module '#auth-utils' {
  interface User {
    id: string
    email: string
  }
  interface UserSession {}
  
  interface SecureSessionData {}
}

export interface SessionUser {
  id: string
  email: string
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
}