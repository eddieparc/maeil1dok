import mysql from 'mysql2/promise'
import { writeFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { isDryRun, getTableFlag } from './config.ts'
import { createMySQLConnection, logProgress } from './utils.ts'
import type { ExtractionSummary } from './types.ts'

const DATA_DIR = join(import.meta.dirname, 'data')
const PAGE_SIZE = 5000

interface TableConfig {
  djangoTable: string
  outputFile: string
  largeTable?: boolean
}

const TABLES: TableConfig[] = [
  { djangoTable: 'accounts_user', outputFile: 'users.json' },
  { djangoTable: 'accounts_socialaccount', outputFile: 'social_accounts.json' },
  { djangoTable: 'accounts_userprofile', outputFile: 'user_profiles.json' },
  { djangoTable: 'accounts_follow', outputFile: 'follows.json' },
  { djangoTable: 'accounts_userreadingsettings', outputFile: 'user_reading_settings.json' },
  { djangoTable: 'todos_biblereadingplan', outputFile: 'bible_reading_plans.json' },
  { djangoTable: 'todos_plansubscription', outputFile: 'plan_subscriptions.json' },
  { djangoTable: 'todos_dailybibleschedule', outputFile: 'daily_schedules.json', largeTable: true },
  { djangoTable: 'todos_userbibleprogress', outputFile: 'user_progress.json', largeTable: true },
  { djangoTable: 'todos_videobibleintro', outputFile: 'video_bible_intros.json' },
  { djangoTable: 'todos_uservideointroprogress', outputFile: 'user_video_intro_progress.json' },
  { djangoTable: 'todos_hasenarecord', outputFile: 'hasena_records.json' },
  { djangoTable: 'todos_hasenasummary', outputFile: 'hasena_summaries.json' },
  { djangoTable: 'todos_catchupsession', outputFile: 'catchup_sessions.json' },
  { djangoTable: 'todos_catchupschedule', outputFile: 'catchup_schedules.json' },
  { djangoTable: 'todos_userplandisplaysettings', outputFile: 'user_plan_display_settings.json' },
  { djangoTable: 'todos_userreadingposition', outputFile: 'user_reading_positions.json' },
  { djangoTable: 'todos_biblebookmark', outputFile: 'bible_bookmarks.json' },
  { djangoTable: 'todos_reflectionnote', outputFile: 'reflection_notes.json' },
  { djangoTable: 'todos_personalreadingrecord', outputFile: 'personal_reading_records.json' },
  { djangoTable: 'todos_biblehighlight', outputFile: 'bible_highlights.json' },
]

async function extractLargeTable(pool: mysql.Pool, tableName: string): Promise<unknown[]> {
  const all: unknown[] = []
  let offset = 0
  while (true) {
    const [rows] = await pool.execute(
      `SELECT * FROM \`${tableName}\` LIMIT ? OFFSET ?`,
      [PAGE_SIZE, offset]
    )
    const rowArray = rows as unknown[]
    all.push(...rowArray)
    logProgress(`Extracting ${tableName}`, all.length, all.length)
    if (rowArray.length < PAGE_SIZE) break
    offset += PAGE_SIZE
  }
  return all
}

async function extractTable(pool: mysql.Pool, config: TableConfig): Promise<unknown[]> {
  if (config.largeTable) {
    return extractLargeTable(pool, config.djangoTable)
  }
  const [rows] = await pool.execute(`SELECT * FROM \`${config.djangoTable}\``)
  return rows as unknown[]
}

async function main() {
  const pool = await createMySQLConnection()

  try {
    if (!isDryRun) {
      mkdirSync(DATA_DIR, { recursive: true })
    }

    const tableFlag = getTableFlag()
    const tablesToExtract = tableFlag
      ? TABLES.filter(t => t.djangoTable === tableFlag || t.outputFile === tableFlag)
      : TABLES

    if (tablesToExtract.length === 0) {
      console.error(`No table found matching: ${tableFlag}`)
      process.exit(1)
    }

    const summary: ExtractionSummary = {}

    for (const table of tablesToExtract) {
      const rows = await extractTable(pool, table)
      const count = rows.length
      const summaryKey = table.outputFile.replace('.json', '')
      summary[summaryKey] = count

      console.log(`[${table.djangoTable}] ${count} rows`)

      if (!isDryRun) {
        writeFileSync(
          join(DATA_DIR, table.outputFile),
          JSON.stringify(rows, null, 2)
        )
      }
    }

    if (!isDryRun) {
      const outputSummary: Record<string, number | string> = {
        ...summary,
        extracted_at: new Date().toISOString(),
      }
      writeFileSync(
        join(DATA_DIR, 'extraction_summary.json'),
        JSON.stringify(outputSummary, null, 2)
      )
    }

    console.log('\n--- Extraction Summary ---')
    for (const [key, count] of Object.entries(summary)) {
      console.log(`  ${key}: ${count}`)
    }

    if (isDryRun) {
      console.log('\n[DRY RUN] No files written.')
    } else {
      console.log(`\nFiles written to: ${DATA_DIR}`)
    }
  } finally {
    await pool.end()
  }
}

main().catch(console.error)
