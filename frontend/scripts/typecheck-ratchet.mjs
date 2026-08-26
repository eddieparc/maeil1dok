#!/usr/bin/env node
/**
 * 타입체크 래칫.
 *
 * 이 저장소의 `nuxt typecheck`는 이미 오류가 있는 상태다. 전부 고칠 때까지
 * 타입체크를 CI에서 빼두면 새로 들어오는 오류를 아무도 막지 못한다 —
 * 특히 OpenAPI 스키마에서 생성한 API 계약 타입은 typecheck가 유일한 집행 수단이다.
 *
 * 그래서 기존 오류를 기준선(baseline)으로 고정하고 **새로 생긴 오류만** 실패시킨다.
 * 기존 오류를 고치면 기준선을 줄여야 통과하므로(래칫), 부채는 늘어날 수 없고 줄기만 한다.
 *
 * 사용:
 *   node scripts/typecheck-ratchet.mjs            검사 (CI)
 *   node scripts/typecheck-ratchet.mjs --update   기준선 갱신
 */

import { spawnSync } from 'node:child_process'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const projectRoot = join(here, '..')
const baselinePath = join(projectRoot, 'typecheck-baseline.json')

// `app/foo.vue(12,34): error TS2339: 메시지` 에서 줄·열을 뺀 시그니처를 만든다.
// 줄번호를 포함하면 무관한 편집에도 기준선이 깨져서 래칫이 잡음이 된다.
const ERROR_LINE = /^(?<file>[^(]+)\((?<line>\d+),(?<col>\d+)\):\s+error\s+(?<code>TS\d+):\s+(?<message>.*)$/

function runTypecheck() {
  const result = spawnSync('npx', ['nuxt', 'typecheck'], {
    cwd: projectRoot,
    encoding: 'utf8',
    maxBuffer: 64 * 1024 * 1024,
  })
  return `${result.stdout ?? ''}${result.stderr ?? ''}`
}

function collect(output) {
  const counts = new Map()
  for (const raw of output.split('\n')) {
    const match = ERROR_LINE.exec(raw.trim())
    if (!match) continue
    const { file, code, message } = match.groups
    const signature = `${file}: ${code}: ${message}`
    counts.set(signature, (counts.get(signature) ?? 0) + 1)
  }
  return counts
}

function toObject(counts) {
  return Object.fromEntries([...counts.entries()].sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)))
}

const update = process.argv.includes('--update')
const output = runTypecheck()
const current = collect(output)
const total = [...current.values()].reduce((sum, n) => sum + n, 0)

if (update) {
  writeFileSync(
    baselinePath,
    `${JSON.stringify({ total, signatures: toObject(current) }, null, 2)}\n`,
    'utf8',
  )
  console.log(`기준선 갱신: 시그니처 ${current.size}종 / 오류 ${total}건 -> ${baselinePath}`)
  process.exit(0)
}

if (!existsSync(baselinePath)) {
  console.error(`기준선이 없다: ${baselinePath}\n먼저 --update 로 생성하라.`)
  process.exit(2)
}

const baseline = JSON.parse(readFileSync(baselinePath, 'utf8'))
const allowed = new Map(Object.entries(baseline.signatures ?? {}))

const introduced = []
for (const [signature, count] of current) {
  const permitted = allowed.get(signature) ?? 0
  if (count > permitted) {
    introduced.push({ signature, count, permitted })
  }
}

const fixed = []
for (const [signature, permitted] of allowed) {
  const count = current.get(signature) ?? 0
  if (count < permitted) fixed.push({ signature, count, permitted })
}

if (introduced.length > 0) {
  console.error('타입체크 래칫 실패 — 기준선에 없는 오류가 새로 생겼다.\n')
  for (const { signature, count, permitted } of introduced) {
    console.error(`  + ${signature}`)
    console.error(`      기준선 ${permitted}건 -> 현재 ${count}건`)
  }
  console.error(
    '\n이 오류들을 고쳐라. 의도적으로 기준선을 올리는 것은 부채를 늘리는 것이므로 하지 마라.',
  )
  process.exit(1)
}

if (fixed.length > 0) {
  console.error('타입체크 래칫 실패 — 오류를 고쳤으니 기준선을 낮춰야 한다.\n')
  for (const { signature, count, permitted } of fixed) {
    console.error(`  - ${signature}`)
    console.error(`      기준선 ${permitted}건 -> 현재 ${count}건`)
  }
  console.error('\n`npm run typecheck:ratchet:update` 로 기준선을 갱신하고 함께 커밋하라.')
  process.exit(1)
}

console.log(
  `타입체크 래칫 통과 — 기준선 시그니처 ${allowed.size}종 / 오류 ${total}건, 신규 0건.`,
)
