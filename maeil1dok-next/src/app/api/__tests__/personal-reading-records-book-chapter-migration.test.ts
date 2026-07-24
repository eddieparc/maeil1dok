import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { BIBLE_BOOKS } from '../../../lib/bible/books'

const migrationPath = resolve(
  process.cwd(),
  'supabase/migrations/20260711001200_personal_reading_records_book_chapter_invariant.sql'
)

function readMigration(): string {
  return readFileSync(migrationPath, 'utf8')
}

function getPreflight(sql: string): string {
  const doBlocks = sql.match(/DO\s+\$\$[\s\S]*?\$\$\s*;/gi) ?? []
  const preflight = doBlocks.find((block) =>
    /FROM\s+public\.personal_reading_records/i.test(block)
  )

  if (preflight === undefined) {
    throw new Error('Migration must preflight personal_reading_records rows')
  }

  return preflight
}

function getConstraint(sql: string): string {
  const constraint = sql.match(
    /ADD\s+CONSTRAINT\s+personal_reading_records_book_chapter_check\s+CHECK\s*\(([\s\S]*?)\)\s*;/i
  )?.[1]

  if (constraint === undefined) {
    throw new Error('Migration must add personal_reading_records_book_chapter_check')
  }

  return constraint
}

describe('personal_reading_records book/chapter invariant migration', () => {
  it('locks exactly the target table before its preflight and constraint', () => {
    const sql = readMigration()
    const tableLock = sql.match(
      /LOCK\s+TABLE\s+public\.personal_reading_records\s+IN\s+ACCESS\s+EXCLUSIVE\s+MODE\s*;/i
    )?.[0]
    const preflight = getPreflight(sql)
    const constraint = sql.match(
      /ALTER\s+TABLE\s+public\.personal_reading_records\s+ADD\s+CONSTRAINT\s+personal_reading_records_book_chapter_check/i
    )?.[0]

    expect(tableLock).toBeDefined()
    expect(constraint).toBeDefined()
    expect(sql.match(/LOCK\s+TABLE\s+/gi)).toHaveLength(1)

    const lockIndex = sql.indexOf(tableLock ?? '')
    expect(lockIndex).toBeGreaterThanOrEqual(0)
    expect(lockIndex).toBeLessThan(sql.indexOf(preflight))
    expect(lockIndex).toBeLessThan(sql.indexOf(constraint ?? ''))
  })

  it('uses a target-table count-only preflight for invalid chapters', () => {
    const preflight = getPreflight(readMigration())
    const invalidCount = preflight.match(
      /SELECT\s+COUNT\s*\(\s*\*\s*\)\s+INTO\s+(\w*count\w*)\s+FROM\s+public\.personal_reading_records/i
    )?.[1]
    const exception = preflight.match(/RAISE\s+EXCEPTION[\s\S]*?;/i)?.[0]

    expect(invalidCount).toBeDefined()
    if (invalidCount === undefined) {
      throw new Error('Preflight must store its invalid row count')
    }

    expect(preflight).toMatch(/chapter\s*<=\s*0/i)
    expect(preflight).toMatch(/chapter\s*>\s*CASE\s+book[\s\S]*?ELSE\s+0\s+END/i)
    expect(preflight).toMatch(
      new RegExp(`IF\\s+${invalidCount}\\s*>\\s*0\\s+THEN\\s+RAISE\\s+EXCEPTION`, 'i')
    )
    expect(exception).toMatch(
      new RegExp(`RAISE\\s+EXCEPTION\\s+'%'\\s*,\\s*${invalidCount}\\s*;`, 'i')
    )
    expect(exception).not.toMatch(/\b(?:id|user_id|book|chapter)\b|ARRAY_AGG|JSON_AGG|STRING_AGG/i)
  })

  it('uses every canonical book mapping in both the preflight and check predicate', () => {
    const sql = readMigration()
    const preflight = getPreflight(sql)
    const constraint = getConstraint(sql)

    expect(Object.keys(BIBLE_BOOKS)).toHaveLength(66)
    for (const [book, definition] of Object.entries(BIBLE_BOOKS)) {
      const mapping = new RegExp(`WHEN\\s+'${book}'\\s+THEN\\s+${definition.chapters}\\b`, 'i')

      expect(preflight).toMatch(mapping)
      expect(constraint).toMatch(mapping)
    }

    expect(preflight).toMatch(/CASE\s+book[\s\S]*?ELSE\s+0\s+END/i)
    expect(constraint).toMatch(/CASE\s+book[\s\S]*?ELSE\s+0\s+END/i)
  })

  it('adds the named positive and bounded chapter check without NOT VALID', () => {
    const sql = readMigration()
    const constraint = getConstraint(sql)

    expect(sql).toMatch(
      /ALTER\s+TABLE\s+public\.personal_reading_records\s+ADD\s+CONSTRAINT\s+personal_reading_records_book_chapter_check\s+CHECK/i
    )
    expect(constraint).toMatch(/chapter\s*>\s*0/i)
    expect(constraint).toMatch(/chapter\s*<=\s*CASE\s+book[\s\S]*?ELSE\s+0\s+END/i)
    expect(sql).not.toMatch(/NOT\s+VALID/i)
  })

  it('does not change unrelated schema objects or mutate rows', () => {
    const sql = readMigration()

    expect(sql).not.toMatch(
      /DROP\s+POLICY|CREATE\s+POLICY|ALTER\s+POLICY|DISABLE\s+ROW\s+LEVEL\s+SECURITY|ENABLE\s+ROW\s+LEVEL\s+SECURITY/i
    )
    expect(sql).not.toMatch(/DROP\s+INDEX|CREATE\s+(?:UNIQUE\s+)?INDEX|ALTER\s+INDEX/i)
    expect(sql).not.toMatch(/ADD\s+COLUMN|DROP\s+COLUMN|ALTER\s+COLUMN/i)
    expect(sql).not.toMatch(/\bINSERT\s+INTO\b|\bUPDATE\b|\bDELETE\s+FROM\b|\bMERGE\s+INTO\b|\bTRUNCATE\b/i)
  })
})
