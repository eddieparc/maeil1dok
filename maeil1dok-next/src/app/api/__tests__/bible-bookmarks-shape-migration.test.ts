import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711000800_bible_bookmark_shape_invariant.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

function getPreflight(sql: string): string {
  const doBlocks = sql.match(/DO\s+\$\$[\s\S]*?\$\$\s*;/gi) ?? []
  const preflight = doBlocks.find((block) => /FROM\s+public\.bible_bookmarks/i.test(block))

  if (preflight === undefined) {
    throw new Error('Migration must preflight invalid bible_bookmarks rows')
  }

  return preflight
}

describe('bible_bookmarks shape invariant migration', () => {
  it('locks the table before cleanup, preflight, and constraint work', () => {
    const sql = readMigration()
    const tableLock = sql.match(
      /LOCK\s+TABLE\s+public\.bible_bookmarks\s+IN\s+ACCESS\s+EXCLUSIVE\s+MODE\s*;/i
    )?.[0]
    const preflight = getPreflight(sql)
    const cleanup = sql.match(/UPDATE\s+public\.bible_bookmarks/i)?.[0]
    const constraint = sql.match(/ADD\s+CONSTRAINT\s+bible_bookmarks_shape_check/i)?.[0]

    expect(tableLock).toBeDefined()
    expect(cleanup).toBeDefined()
    expect(constraint).toBeDefined()

    const lockIndex = sql.indexOf(tableLock ?? '')
    expect(lockIndex).toBeGreaterThanOrEqual(0)
    expect(lockIndex).toBeLessThan(sql.indexOf(cleanup ?? ''))
    expect(lockIndex).toBeLessThan(sql.indexOf(preflight))
    expect(lockIndex).toBeLessThan(sql.indexOf(constraint ?? ''))
  })

  it('normalizes chapter bookmark verse fields to NULL', () => {
    const sql = readMigration()
    const cleanup = sql.match(/UPDATE\s+public\.bible_bookmarks[\s\S]*?;/i)?.[0] ?? ''

    expect(cleanup).toMatch(/SET\s+start_verse\s*=\s*NULL/i)
    expect(cleanup).toMatch(/end_verse\s*=\s*NULL/i)
    expect(cleanup).toMatch(/WHERE\s+bookmark_type\s*=\s*'chapter'/i)
  })

  it('preflights invalid chapter and verse rows before adding the constraint', () => {
    const sql = readMigration()
    const preflight = getPreflight(sql)
    const constraint = sql.match(/ADD\s+CONSTRAINT\s+bible_bookmarks_shape_check/i)?.[0]

    expect(preflight).toMatch(/chapter\s*<=\s*0/i)
    expect(preflight).toMatch(/bookmark_type\s*=\s*'verse'/i)
    expect(preflight).toMatch(/start_verse\s+IS\s+NULL/i)
    expect(preflight).toMatch(/end_verse\s+IS\s+NULL/i)
    expect(preflight).toMatch(/end_verse\s*<\s*start_verse/i)
    expect(sql.indexOf(preflight)).toBeLessThan(sql.indexOf(constraint ?? ''))
  })

  it('raises only a count and does not expose row identifiers', () => {
    const preflight = getPreflight(readMigration())
    const invalidCount = preflight.match(
      /SELECT\s+COUNT\s*\(\s*\*\s*\)\s+INTO\s+(\w*count\w*)/i
    )?.[1]
    const exception = preflight.match(/RAISE\s+EXCEPTION[\s\S]*?;/i)?.[0]

    expect(invalidCount).toBeDefined()
    if (invalidCount === undefined) {
      throw new Error('Preflight must store its invalid row count')
    }

    expect(exception).toMatch(
      new RegExp(`RAISE\\s+EXCEPTION\\s+'%'\\s*,\\s*${invalidCount}\\s*;`, 'i')
    )
    expect(exception).not.toMatch(/\b(?:id|user_id)\b|ARRAY_AGG|JSON_AGG|STRING_AGG/i)
  })

  it('requires canonical chapter and verse shapes in the check constraint', () => {
    const sql = readMigration()
    const constraint = sql.match(
      /ADD\s+CONSTRAINT\s+bible_bookmarks_shape_check\s+CHECK\s*\(([\s\S]*?)\)\s*;/i
    )?.[1]

    expect(constraint).toBeDefined()
    if (constraint === undefined) {
      throw new Error('Migration must add bible_bookmarks_shape_check')
    }

    expect(constraint).toMatch(/chapter\s*>\s*0/i)
    expect(constraint).toMatch(
      /bookmark_type\s*=\s*'chapter'\s+AND\s+start_verse\s+IS\s+NULL\s+AND\s+end_verse\s+IS\s+NULL/i
    )
    expect(constraint).toMatch(/bookmark_type\s*=\s*'verse'/i)
    expect(constraint).toMatch(/start_verse\s+IS\s+NOT\s+NULL/i)
    expect(constraint).toMatch(/end_verse\s+IS\s+NOT\s+NULL/i)
    expect(constraint).toMatch(/start_verse\s*>\s*0/i)
    expect(constraint).toMatch(/end_verse\s*>\s*0/i)
    expect(constraint).toMatch(/end_verse\s*>=\s*start_verse/i)
  })

  it('does not alter RLS policies', () => {
    const sql = readMigration()
    expect(sql).not.toMatch(
      /DROP\s+POLICY|CREATE\s+POLICY|ALTER\s+POLICY|DISABLE\s+ROW\s+LEVEL\s+SECURITY|ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    )
  })

  it('does not drop the existing unique bookmark indexes', () => {
    const sql = readMigration()
    expect(sql).not.toMatch(/DROP\s+INDEX/i)
    expect(sql).not.toMatch(/unique_chapter_bookmark/i)
    expect(sql).not.toMatch(/unique_verse_bookmark/i)
  })
})
