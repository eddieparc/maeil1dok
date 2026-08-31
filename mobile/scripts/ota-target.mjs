export function resolveUpdateTarget(appConfig, { fingerprint = null } = {}) {
  const expo = appConfig?.expo
  const projectId = expo?.extra?.eas?.projectId
  if (typeof projectId !== 'string' || !projectId) {
    return { ok: false, reason: 'app.json has no expo.extra.eas.projectId' }
  }

  const policy = expo?.runtimeVersion?.policy
  if (policy === 'fingerprint') {
    if (typeof fingerprint !== 'string' || !fingerprint) {
      return {
        ok: false,
        reason: 'runtimeVersion.policy is fingerprint but no native fingerprint was supplied',
      }
    }
    return { ok: true, projectId, runtimeVersion: fingerprint }
  }
  if (policy !== 'appVersion') {
    return {
      ok: false,
      reason: `unsupported runtimeVersion.policy: ${policy ?? 'unset'}`,
    }
  }

  const runtimeVersion = expo?.version
  if (typeof runtimeVersion !== 'string' || !runtimeVersion) {
    return { ok: false, reason: 'app.json has no expo.version to use as the runtime' }
  }
  return { ok: true, projectId, runtimeVersion }
}

export function evaluateServedUpdate({ before, after }) {
  if (after === null || after === undefined) {
    return {
      ok: false,
      reason:
        'the update server serves nothing for this runtime and channel after publishing; ' +
        'no client asking for them will ever receive this update',
    }
  }
  if (before === after) {
    return {
      ok: false,
      reason: `the served update is unchanged (${after}); the publish did not take effect`,
    }
  }
  return { ok: true, updateId: after }
}

export function evaluateMarker(marker, expectedSha) {
  if (marker === null || typeof marker !== 'object') {
    return { ok: false, reason: 'marker is not an object' }
  }
  if (typeof marker.commit !== 'string' || !marker.commit) {
    return { ok: false, reason: 'marker has no commit field' }
  }
  if (marker.commit === 'unknown') {
    return {
      ok: false,
      reason: 'the deployed web build has an unknown commit marker; rebuild and redeploy',
    }
  }
  const matches = marker.commit === expectedSha || marker.commit.startsWith(expectedSha)
  if (!matches) {
    return {
      ok: false,
      reason:
        `deployed web commit ${marker.commit} does not match --requires-web ${expectedSha}; ` +
        'deploy the web build before publishing the shell',
    }
  }
  return { ok: true, marker }
}
