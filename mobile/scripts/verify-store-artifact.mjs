#!/usr/bin/env node
/**
 * Refuse a store-bound build that cannot receive updates.
 *
 * The 2026-08-29 incident: the shipped binary was produced from a local
 * `expo prebuild` and submitted by hand. prebuild does not inject an update
 * channel — EAS Build does — so the binary asked the update server for a
 * manifest with no `expo-channel-name` and was answered HTTP 400 every time.
 * Months of OTA publishing reached nobody, and nothing in the repo revealed it
 * because `mobile/ios` and `mobile/android` are gitignored.
 *
 * Two modes, because the mistake can be caught at two different moments:
 *
 *   --native            inspect the prebuilt native projects, right after
 *                       prebuild and before any build is even started.
 *   --artifact <path>   inspect a produced .app / .ipa / .apk / .aab, which is
 *                       the last chance before submission.
 *
 * Reads compiled binary manifests through their string pool, so no `aapt2` or
 * Xcode tooling has to be installed for this check to run.
 */

import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { dirname, extname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  extractAndroidChannel,
  extractIosChannel,
  judgeChannel,
} from './storeArtifactChannelRuntime.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const mobileRoot = resolve(here, '..')

function fail(message) {
  process.stderr.write(`verify-store-artifact: ${message}\n`)
  process.exit(1)
}

function parseArgs(argv) {
  const args = { native: false, artifact: null, channel: 'production' }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const next = () => {
      const value = argv[index + 1]
      if (!value || value.startsWith('--')) fail(`${flag} needs a value`)
      index += 1
      return value
    }
    switch (flag) {
      case '--native':
        args.native = true
        break
      case '--artifact':
        args.artifact = next()
        break
      case '--channel':
        args.channel = next()
        break
      default:
        fail(`unknown argument: ${flag}`)
    }
  }
  if (!args.native && !args.artifact) {
    fail('choose --native (prebuilt projects) or --artifact <path> (built binary)')
  }
  return args
}

/** Every byte of a zip member, or null when the member is absent. */
function readZipMember(archive, member) {
  try {
    return execFileSync('unzip', ['-p', archive, member], {
      encoding: 'latin1',
      maxBuffer: 64 * 1024 * 1024,
    })
  } catch {
    return null
  }
}

function listZip(archive) {
  try {
    return execFileSync('unzip', ['-Z1', archive], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 })
      .split('\n')
      .filter(Boolean)
  } catch {
    return []
  }
}

/** Xcode compiles Info/Expo plists to the binary format; convert before reading. */
function readPlist(target) {
  try {
    return execFileSync('plutil', ['-convert', 'xml1', '-o', '-', target], {
      encoding: 'utf8',
      maxBuffer: 16 * 1024 * 1024,
    })
  } catch {
    // Not macOS, or already XML. The raw text still parses in the XML case.
    return readFileSync(target, 'utf8')
  }
}

function findFile(root, name, skip = []) {
  const stack = [root]
  while (stack.length) {
    const current = stack.pop()
    let entries
    try {
      entries = readdirSync(current, { withFileTypes: true })
    } catch {
      continue
    }
    for (const entry of entries) {
      const full = join(current, entry.name)
      if (entry.isDirectory()) {
        if (!skip.includes(entry.name)) stack.push(full)
      } else if (entry.name === name) return full
    }
  }
  return null
}

function checkNative(expected) {
  const results = []

  // `build` and `Pods` are excluded deliberately: a stale artifact from an older
  // configuration sitting under ios/build would be judged instead of the project
  // that the next build will actually consume.
  const plistPath = findFile(join(mobileRoot, 'ios'), 'Expo.plist', ['build', 'Pods', 'DerivedData'])
  if (plistPath) {
    results.push(
      judgeChannel({
        platform: `ios (${plistPath.replace(`${mobileRoot}/`, '')})`,
        found: extractIosChannel(readPlist(plistPath)),
        expected,
      }),
    )
  }

  const manifestPath = join(mobileRoot, 'android/app/src/main/AndroidManifest.xml')
  if (existsSync(manifestPath)) {
    results.push(
      judgeChannel({
        platform: 'android (AndroidManifest.xml)',
        found: extractAndroidChannel(readFileSync(manifestPath, 'utf8')),
        expected,
      }),
    )
  }

  if (results.length === 0) {
    fail('no prebuilt native project found; run `npx expo prebuild` first')
  }
  return results
}

function checkArtifact(target, expected) {
  const path = resolve(target)
  if (!existsSync(path)) fail(`artifact not found: ${path}`)

  const extension = extname(path)

  if (statSync(path).isDirectory() && extension === '.app') {
    const plistPath = findFile(path, 'Expo.plist')
    if (!plistPath) fail(`${path} contains no Expo.plist; expo-updates is not configured at all`)
    return [
      judgeChannel({
        platform: 'ios (.app)',
        found: extractIosChannel(readPlist(plistPath)),
        expected,
      }),
    ]
  }

  if (extension === '.ipa') {
    const member = listZip(path).find((name) => name.endsWith('.app/Expo.plist'))
    if (!member) fail(`${path} contains no Expo.plist; expo-updates is not configured at all`)
    return [
      judgeChannel({
        platform: 'ios (.ipa)',
        found: extractIosChannel(readZipMember(path, member) ?? ''),
        expected,
      }),
    ]
  }

  if (extension === '.apk' || extension === '.aab') {
    const member = extension === '.apk' ? 'AndroidManifest.xml' : 'base/manifest/AndroidManifest.xml'
    const raw = readZipMember(path, member)
    if (raw === null) fail(`${path} has no ${member}`)
    return [
      judgeChannel({
        platform: `android (${extension})`,
        found: extractAndroidChannel(raw),
        expected,
      }),
    ]
  }

  fail(`unsupported artifact type: ${extension || path}`)
}

const args = parseArgs(process.argv.slice(2))
const verdicts = args.native ? checkNative(args.channel) : checkArtifact(args.artifact, args.channel)

let failed = false
for (const verdict of verdicts) {
  process.stdout.write(`${verdict.ok ? 'OK  ' : 'FAIL'} ${verdict.reason}\n`)
  if (!verdict.ok) failed = true
}
process.exit(failed ? 1 : 0)
