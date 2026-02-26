export interface User {
  id: string
  email?: string
  phone?: string
  createdAt: string
  updatedAt: string
  emailConfirmedAt?: string
  lastSignInAt?: string
  role?: string
  userMetadata?: Record<string, unknown>
}

export interface Session {
  accessToken: string
  tokenType: string
  expiresIn: number
  expiresAt: number
  refreshToken: string
  user: User
}
