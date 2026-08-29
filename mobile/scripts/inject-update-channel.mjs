#!/usr/bin/env node
/**
 * Put the update channel into a prebuilt native project.
 *
 * `expo prebuild` does not inject a channel — EAS Build does. `scripts/build.sh`
 * offers a local build path right beside the cloud one, and choosing it produced
 * the store binary that could never receive an update: it asked for a manifest
 * with no `expo-channel-name` and was answered HTTP 400 every time.
 *
 * Run right after prebuild so the local path ends up where EAS would have put it.
 * Idempotent, so re-running prebuild and this in a loop is safe.
 */

import { existsSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { injectAndroidChannel, injectIosChannel } from './storeArtifactChannelRuntime.mjs'

const mobileRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')

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

const channelIndex = process.argv.indexOf('--channel')
const channel = channelIndex === -1 ? 'production' : process.argv[channelIndex + 1]
if (!channel || channel.startsWith('--')) {
  process.stderr.write('inject-update-channel: --channel needs a value\n')
  process.exit(1)
}

let touched = 0

const plistPath = findFile(join(mobileRoot, 'ios'), 'Expo.plist', ['build', 'Pods', 'DerivedData'])
if (plistPath) {
  const before = readFileSync(plistPath, 'utf8')
  const after = injectIosChannel(before, channel)
  if (after !== before) {
    writeFileSync(plistPath, after)
    touched += 1
  }
  process.stdout.write(`ios   ${plistPath.replace(`${mobileRoot}/`, '')} -> channel "${channel}"\n`)
}

const manifestPath = join(mobileRoot, 'android/app/src/main/AndroidManifest.xml')
if (existsSync(manifestPath)) {
  const before = readFileSync(manifestPath, 'utf8')
  const after = injectAndroidChannel(before, channel)
  if (after !== before) {
    writeFileSync(manifestPath, after)
    touched += 1
  }
  process.stdout.write(`android AndroidManifest.xml -> channel "${channel}"\n`)
}

if (!plistPath && !existsSync(manifestPath)) {
  process.stderr.write('inject-update-channel: no prebuilt native project found\n')
  process.exit(1)
}
process.stdout.write(`inject-update-channel: ${touched} file(s) changed\n`)
