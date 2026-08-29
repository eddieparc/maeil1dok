// Generated companion of `storeArtifactChannel.ts` for the Node CLI.
// The .ts file is the source the tests read; keep the two in step (a contract
// test asserts the exported rules stay identical).
export const CHANNEL_HEADER = 'expo-channel-name'

export function extractIosChannel(plistXml) {
  const anchor = plistXml.indexOf('EXUpdatesRequestHeaders')
  if (anchor === -1) return null
  const tail = plistXml.slice(anchor)
  const match = tail.match(new RegExp(`<key>${CHANNEL_HEADER}</key>\\s*<string>([^<]*)</string>`))
  const value = match?.[1]?.trim()
  return value ? value : null
}

export function extractAndroidChannel(manifestSource) {
  // Text manifests escape quotes as `&quot;`; .apk/.aab hold binary XML whose
  // string pool is UTF-16LE, so stripping NULs turns that into the ASCII case.
  const candidates = [manifestSource, manifestSource.replace(/\0/g, '')]
  for (const candidate of candidates) {
    const decoded = candidate.replace(/&quot;/g, '"')
    const match = decoded.match(new RegExp(`"${CHANNEL_HEADER}"\\s*:\\s*"([^"]*)"`))
    const value = match?.[1]?.trim()
    if (value) return value
  }
  return null
}

export function judgeChannel(input) {
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
