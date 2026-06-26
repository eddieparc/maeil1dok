import { NextRequest, NextResponse } from 'next/server'
import { syncHasenaEntries } from '@/lib/hasena/hasenaSync'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const maxEntries = Number(request.nextUrl.searchParams.get('limit') ?? '14')
    const result = await syncHasenaEntries({
      maxEntries: Number.isInteger(maxEntries) && maxEntries > 0 ? Math.min(maxEntries, 50) : 14,
    })

    return NextResponse.json({
      status: 'synced',
      syncedCount: result.synced.length,
      skippedCount: result.skipped.length,
      synced: result.synced,
    })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json({ status: 'error', message }, { status: 500 })
  }
}
