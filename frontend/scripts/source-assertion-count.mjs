#!/usr/bin/env node
/**
 * 소스 텍스트 단언 계수기.
 *
 * `frontend/tests/` 의 상당수 단언이 **소스 파일을 문자열로 읽어 정규식으로 검사**한다.
 * 동작이 아니라 철자를 보므로, 컴포넌트를 재작성하면 동작이 멀쩡해도 깨진다.
 * 반대로 글자만 맞추면 동작이 망가져도 통과한다.
 *
 * **`assert.match` 총수는 이 취약성의 지표가 아니다.** 같은 `assert.match` 라도
 * 첫 인자가 무엇이냐로 성격이 완전히 갈린다:
 *
 *   assert.match(redactSensitiveUrl(input), /\[redacted\]/)   <- 실제 반환값. 동작 검사다.
 *   assert.match(renderedHtml, /aria-label="계정 설정"/)       <- SSR 렌더 결과. 동작 검사다.
 *   assert.match(scriptSetupSource, /import BibleSearchButton/) <- 소스 텍스트. 취약하다.
 *
 * 그래서 첫 인자가 파일에서 읽어온 소스로 보이는 것만 센다.
 *
 * 소스 기반이라고 전부 나쁜 것은 아니다. **부재 증명**("모든 로그 호출이 URL을 가려야 한다")은
 * 런타임으로 증명하기 어려워 소스 검사가 유일하게 정당한 수단인 경우가 있다.
 * 판정별 근거는 `docs/frontend-test-audit.md` 에 단언 단위로 적혀 있다.
 *
 * 사용: node scripts/source-assertion-count.mjs [--json]
 */

import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const testsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'tests')

// 파일에서 읽어온 소스를 담는 변수의 이름 관례.
// `readFile` 결과를 담는 변수는 이 리포에서 예외 없이 이 꼬리표를 쓴다.
const SOURCE_LIKE = /(Source|source|[Tt]emplate|Content)$/
const ASSERT_MATCH = /assert\.match\(\s*([A-Za-z_$][\w$]*)/g

const rows = []
let sourceBased = 0
let valueBased = 0

for (const name of readdirSync(testsDir).filter((f) => f.endsWith('.test.mjs')).sort()) {
  const body = readFileSync(join(testsDir, name), 'utf8')
  let src = 0
  let val = 0
  for (const match of body.matchAll(ASSERT_MATCH)) {
    if (SOURCE_LIKE.test(match[1])) src += 1
    else val += 1
  }
  if (src || val) rows.push({ file: name, source: src, value: val })
  sourceBased += src
  valueBased += val
}

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ sourceBased, valueBased, files: rows }, null, 2))
  process.exit(0)
}

const width = Math.max(...rows.map((r) => r.file.length), 4)
console.log(`${'file'.padEnd(width)}  소스   값`)
for (const row of rows.filter((r) => r.source > 0).sort((a, b) => b.source - a.source)) {
  console.log(`${row.file.padEnd(width)}  ${String(row.source).padStart(4)} ${String(row.value).padStart(4)}`)
}
console.log(
  `\n소스 텍스트 단언 ${sourceBased}건 / 값·렌더 결과 단언 ${valueBased}건` +
    `\n소스 기반이 줄어드는 방향이 옳다. 판정 근거는 docs/frontend-test-audit.md.`,
)
