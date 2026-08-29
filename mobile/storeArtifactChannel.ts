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

export const IOS_HEADERS_KEY = 'EXUpdatesRequestHeaders'
export const ANDROID_HEADERS_KEY =
  'expo.modules.updates.UPDATES_CONFIGURATION_REQUEST_HEADERS_KEY'

/**
 * Put the channel into a prebuilt project.
 *
 * Warning alone does not work here: after `expo prebuild` the channel is ALWAYS
 * absent, so a warning fires on every run and stops being read. The local build
 * path has to END UP with a channel, which is what EAS Build would have done.
 *
 * Idempotent because prebuild is re-run constantly; a second pass must not nest
 * or duplicate the key.
 */
export function injectIosChannel(plistXml: string, channel: string): string {
  const existing = extractIosChannel(plistXml)
  if (existing === channel) return plistXml

  if (existing !== null) {
    const anchor = plistXml.indexOf(IOS_HEADERS_KEY)
    return (
      plistXml.slice(0, anchor) +
      plistXml
        .slice(anchor)
        .replace(
          new RegExp(`(<key>${CHANNEL_HEADER}</key>\\s*<string>)[^<]*(</string>)`),
          `$1${channel}$2`,
        )
    )
  }

  const at = plistXml.indexOf('<dict>')
  if (at === -1) throw new Error('not a plist: no top-level <dict>')
  const block =
    `\n  <key>${IOS_HEADERS_KEY}</key>\n  <dict>\n` +
    `    <key>${CHANNEL_HEADER}</key>\n    <string>${channel}</string>\n  </dict>`
  return plistXml.slice(0, at + '<dict>'.length) + block + plistXml.slice(at + '<dict>'.length)
}

export function injectAndroidChannel(manifestXml: string, channel: string): string {
  const existing = extractAndroidChannel(manifestXml)
  if (existing === channel) return manifestXml

  const value = `{&quot;${CHANNEL_HEADER}&quot;:&quot;${channel}&quot;}`
  const escapedKey = ANDROID_HEADERS_KEY.replace(/\./g, '\\.')

  if (existing !== null) {
    return manifestXml.replace(
      new RegExp(`(android:name="${escapedKey}"\\s+android:value=")[^"]*(")`),
      `$1${value}$2`,
    )
  }

  // Anchored to the update URL rather than `</application>`: the two belong
  // together, and this keeps the edit valid for a manifest fragment too.
  const anchor = manifestXml.match(/<meta-data android:name="expo\.modules\.updates\.EXPO_UPDATE_URL"/)
  if (!anchor) throw new Error('manifest has no expo-updates configuration to attach the channel to')
  return manifestXml.replace(
    anchor[0],
    `<meta-data android:name="${ANDROID_HEADERS_KEY}" android:value="${value}"/>\n    ${anchor[0]}`,
  )
}
