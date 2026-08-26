import type { AuthUser } from '~/composables/useAuthService'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function parseCachedAuthUser(rawAuth: string | null): AuthUser | null {
  if (!rawAuth) return null

  try {
    const parsedAuth: unknown = JSON.parse(rawAuth)
    if (!isRecord(parsedAuth) || !isRecord(parsedAuth.user)) return null

    const {
      id,
      username,
      nickname,
      email,
      profile_image,
      is_staff,
      email_verified,
      has_usable_password_flag,
    } = parsedAuth.user
    if (typeof id !== 'number' || typeof username !== 'string' || typeof nickname !== 'string') return null

    return {
      id,
      username,
      nickname,
      ...(typeof email === 'string' ? { email } : {}),
      ...(typeof profile_image === 'string' ? { profile_image } : {}),
      ...(typeof is_staff === 'boolean' ? { is_staff } : {}),
      ...(typeof email_verified === 'boolean' ? { email_verified } : {}),
      ...(typeof has_usable_password_flag === 'boolean' ? { has_usable_password_flag } : {}),
    }
  } catch (error) {
    if (error instanceof Error) return null
    throw error
  }
}

export function resolveLandingDisplayUser(
  authUser: AuthUser | null,
  isInitialized: boolean,
  cachedUser: AuthUser | null,
): AuthUser | null {
  return authUser ?? (isInitialized ? null : cachedUser)
}

export function resolveFirstPaintState(hasHydrated: boolean): boolean {
  return !hasHydrated
}
