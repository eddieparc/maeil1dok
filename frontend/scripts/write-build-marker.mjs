#!/usr/bin/env node
/**
 * Write `public/_build-marker.json` so a deployed web build can be identified.
 *
 * The shell OTA of Phase 1 (tasks 9, 11, and the shell half of 36) only behaves
 * correctly once the matching web build is live: the new shell stops clearing
 * cookies on a failed restore, and it is the web app that owns the explicit logout
 * sequence. Publishing the shell first leaves a window where the old web asks for a
 * logout the new shell no longer performs destructively -- a logout that does not
 * stick.
 *
 * Ordering used to depend on someone remembering. This marker makes it checkable:
 * the publish gate reads the deployed marker and refuses when it does not carry the
 * commit the shell was built against.
 *
 * Emitted as a static asset rather than a server route so it survives on any host
 * that can serve the build, and so the gate needs nothing but an HTTP GET.
 */

import { execSync } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const target = resolve(here, '..', 'public', '_build-marker.json')

function gitSha() {
  // CI provides the SHA directly; a local build falls back to git. An unknown SHA
  // is written as `unknown` rather than omitted, so the gate sees an explicit
  // value it can reject instead of a missing field it might treat as optional.
  const fromEnv = process.env.GITHUB_SHA || process.env.COMMIT_SHA
  if (fromEnv && fromEnv.trim()) return fromEnv.trim()
  try {
    return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'unknown'
  }
}

const marker = {
  commit: gitSha(),
  builtAt: new Date().toISOString(),
}

mkdirSync(dirname(target), { recursive: true })
writeFileSync(target, `${JSON.stringify(marker, null, 2)}\n`, 'utf8')
process.stdout.write(`build marker: ${marker.commit} -> ${target}\n`)
