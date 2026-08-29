#!/usr/bin/env node
/**
 * Publish gate for shell OTA updates.
 *
 * Section 8 of the plan requires "web first, shell second" for the Phase 1 shell
 * OTA, and platform-by-platform publication. Both used to rest on memory. This
 * script makes the caller state which case they are in, and refuses when the claim
 * does not hold.
 *
 * The rule is scoped, not blanket. Only the Phase 1 shell OTA carries shell changes
 * that depend on a matching web build; the task-5 no-op rehearsal and the task-38
 * navigation hotfix do not, and a gate that rejected everything would make those
 * impossible to publish -- including a later re-publish of the hotfix. So the caller
 * declares intent explicitly:
 *
 *   --requires-web <sha>       verify the deployed web marker equals <sha>
 *   --no-web-dependency <why>  assert this OTA carries no web-dependent change
 *
 * Exactly one is required. Defaulting either way is what this script exists to
 * prevent: defaulting to skip re-creates the ordering bug, and defaulting to
 * require blocks the rehearsal and the security hotfix.
 *
 * `--check-only` runs every check and reports, without publishing. That is the mode
 * the operator uses before touching production.
 */

import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const WEB_ORIGIN = process.env.WEB_ORIGIN || 'https://maeil1dok.app'
const MARKER_PATH = '/_build-marker.json'
const PLATFORMS = new Set(['ios', 'android'])
const MOBILE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * What runtime and project does a published update belong to?
 *
 * Derived from app config rather than assumed, because guessing the runtime makes
 * the reach check worthless: it would query a runtime no installed app asks for
 * and report the answer as proof.
 */
export function resolveUpdateTarget(appConfig) {
  const expo = appConfig?.expo
  const projectId = expo?.extra?.eas?.projectId
  if (typeof projectId !== 'string' || !projectId) {
    return { ok: false, reason: 'app.json has no expo.extra.eas.projectId' }
  }
  const policy = expo?.runtimeVersion?.policy
  if (policy !== 'appVersion') {
    return {
      ok: false,
      reason:
        `runtimeVersion.policy is ${policy ?? 'unset'}; this gate can only derive ` +
        'the runtime when the policy is appVersion. Update the gate together with the policy.',
    }
  }
  const runtimeVersion = expo?.version
  if (typeof runtimeVersion !== 'string' || !runtimeVersion) {
    return { ok: false, reason: 'app.json has no expo.version to use as the runtime' }
  }
  return { ok: true, projectId, runtimeVersion }
}

/**
 * Did the publish become the update the server actually serves?
 *
 * `eas update` printing "Published!" says a record was created, not that any
 * client will be offered it. Comparing the served update id across the publish is
 * the cheapest honest check: it fails when the runtime/channel pair serves nothing
 * and when the new update did not take effect.
 */
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

/** Thin HTTP layer; the decision above is what carries the coverage. */
async function fetchServedUpdateId({ projectId, platform, runtimeVersion, channel }) {
  try {
    const response = await fetch(`https://u.expo.dev/${projectId}`, {
      headers: {
        'expo-protocol-version': '1',
        'expo-api-version': '1',
        'expo-platform': platform,
        'expo-runtime-version': runtimeVersion,
        'expo-channel-name': channel,
        'expo-expect-signature': 'false',
        accept: 'multipart/mixed',
      },
    })
    if (response.status !== 200) return null
    const body = await response.text()
    return body.match(/"id"\s*:\s*"([^"]+)"/)?.[1] ?? null
  } catch {
    return null
  }
}

function fail(message) {
  process.stderr.write(`publish-ota: ${message}\n`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = {
    requiresWeb: null,
    noWebDependency: null,
    platform: null,
    channel: 'production',
    checkOnly: false,
    message: null,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) fail(`${flag} needs a value`)
      index += 1
      return value
    }
    switch (flag) {
      case '--requires-web':
        args.requiresWeb = next()
        break
      case '--no-web-dependency':
        args.noWebDependency = next()
        break
      case '--platform':
        args.platform = next()
        break
      case '--channel':
        args.channel = next()
        break
      case '--message':
        args.message = next()
        break
      case '--check-only':
        args.checkOnly = true
        break
      default:
        fail(`unknown argument: ${flag}`)
    }
  }
  return args
}

function assertIntentDeclared(args) {
  const declared = [args.requiresWeb, args.noWebDependency].filter(Boolean)
  if (declared.length === 0) {
    fail(
      'declare intent: --requires-web <sha> for a Phase 1 shell OTA, or ' +
        '--no-web-dependency <reason> for the rehearsal / navigation hotfix',
    )
  }
  if (declared.length === 2) {
    fail('--requires-web and --no-web-dependency are mutually exclusive')
  }
}

function assertPlatform(args) {
  // Publishing both platforms in one command hides a partial failure: one platform
  // can succeed while the other does not, and the operator sees a single exit code.
  if (!args.platform) fail('--platform ios|android is required (publish one at a time)')
  if (!PLATFORMS.has(args.platform)) fail(`--platform must be ios or android, got ${args.platform}`)
}

/**
 * Decide whether a fetched marker satisfies the requested SHA.
 *
 * Pure on purpose: exported so tests can drive every verdict without standing up an
 * HTTP server. An earlier version of the test suite did spin one up per case and
 * hung -- the gate's `fetch` runs in a child process and leaves a keep-alive socket,
 * so `server.close()` never completed. That cost a 25-minute CI failure. The HTTP
 * layer below is now thin enough to need no coverage of its own; what matters is
 * this decision, and it is directly testable.
 *
 * Returns `{ ok: true, marker }` or `{ ok: false, reason }`.
 */
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
  // Prefix comparison so a short SHA works, but only in that direction: a truncated
  // deployed marker must not be allowed to satisfy an unrelated longer SHA.
  const matches =
    marker.commit === expectedSha || marker.commit.startsWith(expectedSha)
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

async function fetchDeployedMarker() {
  const url = `${WEB_ORIGIN}${MARKER_PATH}`
  let response
  try {
    response = await fetch(url, { redirect: 'follow' })
  } catch (error) {
    fail(`could not read ${url}: ${error.message}`)
  }
  if (!response.ok) {
    fail(`${url} returned ${response.status}; deploy the web build first`)
  }
  try {
    return await response.json()
  } catch (error) {
    fail(`${url} is not JSON: ${error.message}`)
  }
}

async function verifyWebMarker(expectedSha) {
  const marker = await fetchDeployedMarker()
  const verdict = evaluateMarker(marker, expectedSha)
  if (!verdict.ok) {
    fail(verdict.reason)
  }
  process.stdout.write(
    `web marker OK: ${verdict.marker.commit} (built ${verdict.marker.builtAt ?? 'unknown'})\n`,
  )
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  assertIntentDeclared(args)
  assertPlatform(args)

  if (args.requiresWeb) {
    await verifyWebMarker(args.requiresWeb)
  } else {
    process.stdout.write(
      `web dependency waived: ${args.noWebDependency}\n` +
        'this must be true only for the rehearsal or a shell-only hotfix\n',
    )
  }

  const command = [
    'eas',
    'update',
    '--channel',
    args.channel,
    '--platform',
    args.platform,
    '--message',
    args.message ?? `ota ${args.platform} ${new Date().toISOString()}`,
  ]

  // Stated on every run, including check-only. An operator who reads only
  // "Published!" concludes the fix shipped. For months it had not: the store
  // binary carries no update channel, so every check it made was answered
  // HTTP 400 and no published update ever reached it.
  process.stdout.write(
    '게시는 도달이 아니다 — 이 명령은 설치된 바이너리가 이 채널을 싣고 있는지 알 수 없다.\n' +
      'publishing does not prove reach; verify the binary with ' +
      '`node scripts/verify-store-artifact.mjs --artifact <path>`\n',
  )

  const appConfig = JSON.parse(readFileSync(resolve(MOBILE_ROOT, 'app.json'), 'utf8'))
  const target = resolveUpdateTarget(appConfig)
  if (!target.ok) fail(target.reason)

  if (args.checkOnly) {
    process.stdout.write(`check-only: would run npx ${command.join(' ')}\n`)
    return
  }

  const query = {
    projectId: target.projectId,
    platform: args.platform,
    runtimeVersion: target.runtimeVersion,
    channel: args.channel,
  }
  const before = await fetchServedUpdateId(query)

  process.stdout.write(`running npx ${command.join(' ')}\n`)
  execFileSync('npx', command, { stdio: 'inherit' })

  // The CDN can take a moment to serve a freshly published update. Bounded and
  // exit-early: it stops the instant the served id changes, and a stall becomes a
  // reported failure instead of a silent pass.
  let after = null
  for (let attempt = 0; attempt < 6; attempt += 1) {
    after = await fetchServedUpdateId(query)
    if (after !== null && after !== before) break
    await new Promise((done) => setTimeout(done, 5000))
  }

  const served = evaluateServedUpdate({ before, after })
  if (!served.ok) fail(served.reason)
  process.stdout.write(
    `served update for runtime ${target.runtimeVersion} on channel ${args.channel}: ${served.updateId}\n`,
  )
}

// Only run when invoked as a script, so tests can import `evaluateMarker` without
// triggering a publish.
const invokedDirectly = process.argv[1] && process.argv[1].endsWith('publish-ota.mjs')
if (invokedDirectly) {
  main().catch((error) => fail(error.message))
}
