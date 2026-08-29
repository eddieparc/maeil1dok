/**
 * Should this page tell the user to update the app from the store?
 *
 * The installed store binary carries no update channel, so it asks the update
 * server for a manifest without `expo-channel-name` and is answered with
 * `HTTP 400 "channel-name": Required`. No OTA can ever reach it. The only way
 * those users get the session fixes is a NEW STORE BUILD, and the only surface
 * that can tell them so is the web app they are already looking at.
 *
 * Who is advised is decided by `shellBundleIdentity.ts`:
 *
 *   not-in-app     an ordinary browser. It has no app to update.
 *   reported       the new shell announced its bundle. It already has the fix.
 *   legacy-shell   inside the app, announcing nothing. Only the old shell does
 *                  that, so silence is the signal.
 *
 * `blocking` exists but is NOT the default, and that is a deliberate safety
 * property rather than timidity: until a newer build is actually live in both
 * stores, blocking would strand every installed user in front of a wall with
 * nothing to update to. Flip it only after the store listing shows the new
 * version.
 */

export type ShellEnforcement = 'notice' | 'blocking'
export type ShellUpdateMode = 'hidden' | 'notice' | 'blocking'
export type ShellPlatform = 'ios' | 'android' | 'unknown'

/** Resolved from the public App Store lookup for bundle id `com.maeil1dok.app`. */
export const IOS_STORE_URL = 'https://apps.apple.com/kr/app/id6758072829'
export const ANDROID_STORE_URL =
  'https://play.google.com/store/apps/details?id=app.maeil1dok.mobile'

export type ShellUpdateAdvice = {
  readonly mode: ShellUpdateMode
  readonly platform: ShellPlatform
  readonly storeUrl: string | null
}

function resolvePlatform(isAndroidHint: unknown, userAgent: string): ShellPlatform {
  // The shell injects this as a real boolean literal. Anything else is not a
  // hint we may trust: the string 'false' is truthy, and coercing it would send
  // every iOS user to Play.
  if (isAndroidHint === true) return 'android'
  if (isAndroidHint === false) return 'ios'

  if (/android/i.test(userAgent)) return 'android'
  if (/iphone|ipad|ipod/i.test(userAgent)) return 'ios'
  return 'unknown'
}

const STORE_URLS: Record<ShellPlatform, string | null> = {
  ios: IOS_STORE_URL,
  android: ANDROID_STORE_URL,
  unknown: null,
}

export function adviseShellUpdate(input: {
  identityState: 'not-in-app' | 'legacy-shell' | 'reported'
  isAndroidHint?: unknown
  userAgent?: string
  enforcement?: unknown
}): ShellUpdateAdvice {
  if (input.identityState !== 'legacy-shell') {
    return { mode: 'hidden', platform: 'unknown', storeUrl: null }
  }

  const platform = resolvePlatform(input.isAndroidHint, input.userAgent ?? '')
  // Unknown enforcement degrades to `notice`, never up to `blocking`: a typo in
  // an env var must not lock users out of a working app.
  const mode: ShellUpdateMode = input.enforcement === 'blocking' ? 'blocking' : 'notice'

  return { mode, platform, storeUrl: STORE_URLS[platform] }
}
