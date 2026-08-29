/**
 * Which shell bundle is this page running inside?
 *
 * The shell exposes the same identity on its native login screen, but that screen
 * only appears when signed OUT — which makes it unreadable in the state operators
 * are normally in. This is the surface that works while signed in.
 *
 * The three answers are deliberately distinct:
 *
 *   not-in-app     an ordinary browser. Nothing to say.
 *   legacy-shell   inside the app, reporting nothing. The old shell injects
 *                  `isReactNativeWebView` but knows nothing about bundle identity,
 *                  so silence here is a POSITIVE answer: the OTA has not reached
 *                  this device. Reading it as "no data" is what makes an OTA reach
 *                  test unfalsifiable.
 *   reported       the new shell told us which bundle it is running.
 *
 * `embedded` and an update id are also different answers — embedded means no OTA
 * has been applied, an id means one has.
 */

export type ShellIdentityState = 'not-in-app' | 'legacy-shell' | 'reported'

export type ShellIdentityView = {
  readonly state: ShellIdentityState
  readonly visible: boolean
  readonly label: string
}

const UNKNOWN = 'unknown'

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null
}

export function classifyShellIdentity(input: {
  isNativeApp: boolean
  reported: unknown
}): ShellIdentityView {
  if (!input.isNativeApp) {
    return { state: 'not-in-app', visible: false, label: '' }
  }

  const reported = input.reported
  if (typeof reported !== 'object' || reported === null) {
    return { state: 'legacy-shell', visible: true, label: '앱 구버전 — 업데이트 미도달' }
  }

  const record = reported as Record<string, unknown>
  const runtime = readString(record.runtimeVersion) ?? UNKNOWN
  const updateId = readString(record.updateId)
  const isEmbedded = record.isEmbedded === true

  const shortId = isEmbedded ? 'embedded' : (updateId?.split('-')[0] ?? UNKNOWN)

  return { state: 'reported', visible: true, label: `v${runtime} · ${shortId}` }
}
