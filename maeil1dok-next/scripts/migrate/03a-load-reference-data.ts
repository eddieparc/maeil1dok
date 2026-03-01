import { readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { isDryRun, getTableFlag, BATCH_SIZE } from './config.ts'
import { createSupabaseAdmin, batchInsert, loadUserMapping } from './utils.ts'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  DjangoBibleReadingPlan,
  DjangoDailyBibleSchedule,
  DjangoVideoBibleIntro,
  DjangoHasenaSummary,
} from './types.ts'

const DATA_DIR = join(import.meta.dirname, 'data')

// ---------------------------------------------------------------------------
// Local interfaces for tables where types.ts doesn't match actual Django model
// The extraction script (01-extract-mysql.ts) does SELECT * so JSON data
// matches the Django model columns, not the types.ts definitions.
// ---------------------------------------------------------------------------

// Actual Django VideoBibleIntro model fields: url_link, start_date, end_date
// (types.ts DjangoVideoBibleIntro incorrectly defines youtube_id, title, order)
interface ExtractedVideoBibleIntro {
  id: number
  plan_id: number
  book: string
  url_link: string
  start_date: string
  end_date: string
}

// Actual Django HasenaSummary model fields
// (types.ts DjangoHasenaSummary only has id, date, youtube_id, title)
interface ExtractedHasenaSummary {
  id: number
  video_id: string
  video_date: string | null
  title: string
  summary: string
  transcript: string
  model_used: string
  is_edited: boolean
}

// ---------------------------------------------------------------------------
// bible_reading_plans — SERIAL PK, preserve Django integer IDs
// ---------------------------------------------------------------------------
async function loadBibleReadingPlans(
  supabase: SupabaseClient,
  dryRun: boolean
): Promise<void> {
  const djangoData: DjangoBibleReadingPlan[] = JSON.parse(
    readFileSync(join(DATA_DIR, 'bible_reading_plans.json'), 'utf-8')
  )

  console.log(`📖 bible_reading_plans: ${djangoData.length} rows`)

  // Load user mapping to resolve created_by FK
  const userMapping = await loadUserMapping(supabase)

  const supabaseRows = djangoData.map((row) => ({
    id: row.id,
    name: row.name,
    description: row.description ?? '',
    is_default: row.is_default,
    is_active: row.is_active,
    created_by: row.created_by_id != null ? (userMapping.get(row.created_by_id) ?? null) : null,
  }))

  if (!dryRun) {
    await batchInsert(supabase, 'bible_reading_plans', supabaseRows, BATCH_SIZE)
    // After migration, reset the SERIAL sequence:
    // SELECT setval('bible_reading_plans_id_seq', (SELECT MAX(id) FROM bible_reading_plans));
    console.log(`✅ Loaded ${supabaseRows.length} bible_reading_plans (integer IDs preserved)`)
  } else {
    console.log(`[DRY RUN] Would insert ${supabaseRows.length} rows into bible_reading_plans`)
  }
}

// ---------------------------------------------------------------------------
// daily_schedules — UUID PK, create schedule_id_mapping.json
// ---------------------------------------------------------------------------
async function loadDailySchedules(
  supabase: SupabaseClient,
  dryRun: boolean
): Promise<void> {
  const djangoData: DjangoDailyBibleSchedule[] = JSON.parse(
    readFileSync(join(DATA_DIR, 'daily_schedules.json'), 'utf-8')
  )

  console.log(`📅 daily_schedules: ${djangoData.length} rows`)

  const scheduleMapping: Record<string, string> = {}

  const supabaseRows = djangoData.map((row) => {
    const newUUID = randomUUID()
    scheduleMapping[row.id.toString()] = newUUID
    return {
      id: newUUID,
      plan_id: row.plan_id,
      date: row.date,
      book: row.book,
      start_chapter: row.start_chapter,
      end_chapter: row.end_chapter,
      audio_link: row.audio_link ?? null,
      guide_link: row.guide_link ?? null,
    }
  })

  if (!dryRun) {
    await batchInsert(supabase, 'daily_schedules', supabaseRows, BATCH_SIZE)
    writeFileSync(
      join(DATA_DIR, 'schedule_id_mapping.json'),
      JSON.stringify(scheduleMapping, null, 2)
    )
    console.log(
      `✅ Loaded ${supabaseRows.length} daily_schedules, saved schedule_id_mapping.json`
    )
  } else {
    console.log(`[DRY RUN] Would insert ${supabaseRows.length} rows into daily_schedules`)
    console.log(
      `[DRY RUN] Would create schedule_id_mapping.json with ${Object.keys(scheduleMapping).length} entries`
    )
  }
}

// ---------------------------------------------------------------------------
// video_bible_intros — UUID PK, create video_intro_id_mapping.json
// ---------------------------------------------------------------------------
async function loadVideoBibleIntros(
  supabase: SupabaseClient,
  dryRun: boolean
): Promise<void> {
  // Using ExtractedVideoBibleIntro (actual Django fields) instead of
  // DjangoVideoBibleIntro type which has incorrect field definitions.
  const djangoData: ExtractedVideoBibleIntro[] = JSON.parse(
    readFileSync(join(DATA_DIR, 'video_bible_intros.json'), 'utf-8')
  )

  console.log(`🎥 video_bible_intros: ${djangoData.length} rows`)

  const videoIntroMapping: Record<string, string> = {}

  const supabaseRows = djangoData.map((row) => {
    const newUUID = randomUUID()
    videoIntroMapping[row.id.toString()] = newUUID
    return {
      id: newUUID,
      plan_id: row.plan_id,
      book: row.book,
      url_link: row.url_link,
      start_date: row.start_date,
      end_date: row.end_date,
    }
  })

  if (!dryRun) {
    await batchInsert(supabase, 'video_bible_intros', supabaseRows, BATCH_SIZE)
    writeFileSync(
      join(DATA_DIR, 'video_intro_id_mapping.json'),
      JSON.stringify(videoIntroMapping, null, 2)
    )
    console.log(
      `✅ Loaded ${supabaseRows.length} video_bible_intros, saved video_intro_id_mapping.json`
    )
  } else {
    console.log(`[DRY RUN] Would insert ${supabaseRows.length} rows into video_bible_intros`)
    console.log(
      `[DRY RUN] Would create video_intro_id_mapping.json with ${Object.keys(videoIntroMapping).length} entries`
    )
  }
}

// ---------------------------------------------------------------------------
// hasena_summaries — UUID PK, simple insert with new UUIDs
// ---------------------------------------------------------------------------
async function loadHasenaSummaries(
  supabase: SupabaseClient,
  dryRun: boolean
): Promise<void> {
  // Using ExtractedHasenaSummary (actual Django fields) instead of
  // DjangoHasenaSummary type which is missing several fields.
  const djangoData: ExtractedHasenaSummary[] = JSON.parse(
    readFileSync(join(DATA_DIR, 'hasena_summaries.json'), 'utf-8')
  )

  console.log(`📝 hasena_summaries: ${djangoData.length} rows`)

  const supabaseRows = djangoData.map((row) => ({
    id: randomUUID(),
    video_id: row.video_id,
    video_date: row.video_date,
    title: row.title || '',
    summary: row.summary,
    transcript: row.transcript || '',
    model_used: row.model_used || 'gemini-2.0-flash',
    is_edited: row.is_edited ?? false,
  }))

  if (!dryRun) {
    await batchInsert(supabase, 'hasena_summaries', supabaseRows, BATCH_SIZE)
    console.log(`✅ Loaded ${supabaseRows.length} hasena_summaries`)
  } else {
    console.log(`[DRY RUN] Would insert ${supabaseRows.length} rows into hasena_summaries`)
  }
}

// ---------------------------------------------------------------------------
// Table loader registry
// ---------------------------------------------------------------------------
const TABLE_LOADERS: Record<
  string,
  (supabase: SupabaseClient, dryRun: boolean) => Promise<void>
> = {
  bible_reading_plans: loadBibleReadingPlans,
  daily_schedules: loadDailySchedules,
  video_bible_intros: loadVideoBibleIntros,
  hasena_summaries: loadHasenaSummaries,
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main(): Promise<void> {
  const dryRun = isDryRun
  const tableFlag = getTableFlag()
  const supabase = createSupabaseAdmin()

  if (dryRun) {
    console.log('🔍 DRY RUN MODE — no data will be written\n')
  }

  if (tableFlag) {
    const loader = TABLE_LOADERS[tableFlag]
    if (!loader) {
      console.error(`Unknown table: ${tableFlag}`)
      console.error(`Available tables: ${Object.keys(TABLE_LOADERS).join(', ')}`)
      process.exit(1)
    }
    await loader(supabase, dryRun)
  } else {
    console.log('Loading reference data…\n')
    await loadBibleReadingPlans(supabase, dryRun)
    await loadDailySchedules(supabase, dryRun)
    await loadVideoBibleIntros(supabase, dryRun)
    await loadHasenaSummaries(supabase, dryRun)
    console.log('\n✅ All reference data loaded successfully')
  }
}

void main().catch((error: unknown) => {
  console.error(error)
  process.exit(1)
})
