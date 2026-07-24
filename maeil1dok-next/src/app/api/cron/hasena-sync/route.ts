import { NextRequest, NextResponse } from 'next/server'
import { syncHasenaEntries } from '@/lib/hasena/hasenaSync'
import { cronAuthError } from '@/lib/cron/auth'

/**
 * Sanitized alertable failure response for the Hasena cache-filling cron.
 *
 * HTTP status is the Vercel cron alert surface, so a stalled or empty sync
 * must surface as 503 instead of a green 200. `reason` is a fixed public code;
 * raw provider/Supabase exception text is never echoed back.
 */
function serviceUnavailable(reason: string): NextResponse {
  return NextResponse.json({ status: 'error', reason }, { status: 503 })
}

export async function GET(request: NextRequest) {
  const authError = cronAuthError(request)
  if (authError) return authError

  try {
    const maxEntries = Number(request.nextUrl.searchParams.get('limit') ?? '14')
    const result = await syncHasenaEntries({
      maxEntries: Number.isInteger(maxEntries) && maxEntries > 0 ? Math.min(maxEntries, 50) : 14,
    })

    const attemptedDates = [
      ...result.synced.map((entry) => entry.date),
      ...result.skipped,
    ]

    if (attemptedDates.length === 0) {
      return serviceUnavailable('hasena_sync_source_empty')
    }

    if (result.synced.length === 0) {
      return serviceUnavailable('hasena_sync_no_entries_cached')
    }

    // Dates are `YYYY-MM-DD`, so lexicographic max is chronological max.
    const latestAttemptedDate = attemptedDates.reduce((max, date) => (date > max ? date : max))
    if (result.skipped.includes(latestAttemptedDate)) {
      return serviceUnavailable('hasena_sync_latest_entry_skipped')
    }

    return NextResponse.json({
      status: 'synced',
      syncedCount: result.synced.length,
      skippedCount: result.skipped.length,
      synced: result.synced,
    })
  } catch {
    // Deliberately drop the raw exception message; alert on a sanitized code.
    return serviceUnavailable('hasena_sync_failed')
  }
}
