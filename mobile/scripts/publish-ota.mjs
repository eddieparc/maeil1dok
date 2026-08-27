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

const WEB_ORIGIN = process.env.WEB_ORIGIN || 'https://maeil1dok.app'
const MARKER_PATH = '/_build-marker.json'
const PLATFORMS = new Set(['ios', 'android'])

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
  let marker
  try {
    marker = await response.json()
  } catch (error) {
    fail(`${url} is not JSON: ${error.message}`)
  }
  if (!marker || typeof marker.commit !== 'string' || !marker.commit) {
    fail(`${url} has no commit field`)
  }
  return marker
}

async function verifyWebMarker(expectedSha) {
  const marker = await fetchDeployedMarker()
  if (marker.commit === 'unknown') {
    fail('the deployed web build has an unknown commit marker; rebuild and redeploy')
  }
  // Prefix comparison so a short SHA works, but only in that direction: a deployed
  // marker must not be allowed to satisfy an unrelated longer SHA.
  const matches =
    marker.commit === expectedSha || marker.commit.startsWith(expectedSha)
  if (!matches) {
    fail(
      `deployed web commit ${marker.commit} does not match --requires-web ${expectedSha}; ` +
        'deploy the web build before publishing the shell',
    )
  }
  process.stdout.write(`web marker OK: ${marker.commit} (built ${marker.builtAt ?? 'unknown'})\n`)
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

  if (args.checkOnly) {
    process.stdout.write(`check-only: would run npx ${command.join(' ')}\n`)
    return
  }

  process.stdout.write(`running npx ${command.join(' ')}\n`)
  execFileSync('npx', command, { stdio: 'inherit' })
}

main().catch((error) => fail(error.message))
