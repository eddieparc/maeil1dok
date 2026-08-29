/**
 * Does a build carry an update channel?
 *
 * Measured 2026-08-29: the shipped store binary sends no `expo-channel-name`, so
 * every update check is answered
 *
 *     HTTP 400  "channel-name": Required.
 *
 * No runtime version can repair that. The binary is simply outside the update
 * system, and nothing in the repository showed it — `mobile/ios` and
 * `mobile/android` are gitignored, and `expo prebuild` does NOT inject a channel
 * (EAS Build does). A prebuild output looks fully configured: updates enabled,
 * url set, runtime set. Only the one key that decides reach is missing.
 *
 * These readers are pure so the rule can be tested without a device, an EAS
 * account, or a build. `verify-store-artifact.mjs` feeds them real files.
 */

export const CHANNEL_HEADER = 'expo-channel-name'

export type ChannelVerdict = {
  readonly ok: boolean
  readonly reason: string
}

/**
 * iOS keeps the request headers as a nested dict under `EXUpdatesRequestHeaders`.
 * Scoped to that key on purpose: the literal string can also appear in unrelated
 * bundled assets, and matching those would report a channel that is not
 * configured.
 */
export function extractIosChannel(plistXml: string): string | null {
  const anchor = plistXml.indexOf('EXUpdatesRequestHeaders')
  if (anchor === -1) return null
  const tail = plistXml.slice(anchor)
  const match = tail.match(
    new RegExp(`<key>${CHANNEL_HEADER}</key>\\s*<string>([^<]*)</string>`),
  )
  const value = match?.[1]?.trim()
  return value ? value : null
}

/**
 * Android carries the same headers as a JSON string in a `meta-data` value.
 * Handles both forms with one rule: a text AndroidManifest escapes the quotes as
 * `&quot;`, while an `.apk`/`.aab` holds compiled binary XML whose string pool
 * still contains the JSON verbatim. Reading the pool directly means this works
 * without `aapt2` installed.
 */
export function extractAndroidChannel(manifestSource: string): string | null {
  // Three encodings reach this function and all three are real:
  //   text AndroidManifest.xml   quotes escaped as `&quot;`
  //   .apk / .aab                binary XML, string pool in UTF-16LE, so every
  //                              character is followed by a NUL byte
  //   already-clean JSON         from a caller that decoded it
  // Stripping NULs turns the UTF-16 case into the ASCII case rather than needing
  // `aapt2` on the machine running the check.
  const candidates = [manifestSource, manifestSource.replace(/\0/g, '')]
  for (const candidate of candidates) {
    const decoded = candidate.replace(/&quot;/g, '"')
    const match = decoded.match(new RegExp(`"${CHANNEL_HEADER}"\\s*:\\s*"([^"]*)"`))
    const value = match?.[1]?.trim()
    if (value) return value
  }
  return null
}

export function judgeChannel(input: {
  platform: string
  found: string | null
  expected: string
}): ChannelVerdict {
  if (input.found === null) {
    return {
      ok: false,
      reason:
        `${input.platform}: no update channel is configured. A binary without ` +
        `"${CHANNEL_HEADER}" is answered HTTP 400 by the update server and can ` +
        `never receive an OTA. Build it with EAS (which injects the channel from ` +
        `eas.json) instead of shipping a bare prebuild output.`,
    }
  }
  if (input.found !== input.expected) {
    return {
      ok: false,
      reason:
        `${input.platform}: channel is "${input.found}" but "${input.expected}" ` +
        `was expected. Updates published to "${input.expected}" would reach nothing.`,
    }
  }
  return { ok: true, reason: `${input.platform}: channel "${input.found}"` }
}
