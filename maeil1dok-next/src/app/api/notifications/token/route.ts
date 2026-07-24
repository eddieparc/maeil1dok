import { createClient } from '@/lib/supabase/server'
import type { Json } from '@/lib/supabase/database.types'
import { NextResponse } from 'next/server'

type JsonObject = Record<string, unknown>
type ParseResult = { ok: true; value: JsonObject } | { ok: false }

function isJsonObject(value: unknown): value is JsonObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

// Parse a required JSON object body. Rejects malformed JSON, arrays, null,
// and primitive JSON values.
async function parseRequiredJsonObject(request: Request): Promise<ParseResult> {
  let parsed: unknown
  try {
    parsed = await request.json()
  } catch {
    return { ok: false }
  }
  if (!isJsonObject(parsed)) return { ok: false }
  return { ok: true, value: parsed }
}

// Parse an optional JSON object body. An empty or whitespace-only body is
// treated as an empty object. Rejects malformed JSON, arrays, null, and
// primitive JSON values.
async function parseOptionalJsonObject(request: Request): Promise<ParseResult> {
  const raw = await request.text()
  if (raw.trim() === '') return { ok: true, value: {} }
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    return { ok: false }
  }
  if (!isJsonObject(parsed)) return { ok: false }
  return { ok: true, value: parsed }
}

const invalidBody = () =>
  NextResponse.json({ error: 'Invalid request body' }, { status: 400 })

const tokenRequired = () =>
  NextResponse.json({ error: 'Token required' }, { status: 400 })

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await parseRequiredJsonObject(request)
    if (!body.ok) return invalidBody()

    const { token, deviceInfo } = body.value
    if (typeof token !== 'string' || token.trim() === '') return tokenRequired()

    const { error } = await supabase.from('fcm_tokens').upsert(
      {
        user_id: user.id,
        token: token.trim(),
        device_info: (deviceInfo ?? null) as Json | null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    )
    if (error)
      return NextResponse.json(
        { error: 'Failed to save notification token' },
        { status: 500 }
      )

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const body = await parseOptionalJsonObject(request)
    if (!body.ok) return invalidBody()

    const { token } = body.value

    let result
    if (token === undefined) {
      // Delete all tokens for user (logout)
      result = await supabase.from('fcm_tokens').delete().eq('user_id', user.id)
    } else {
      if (typeof token !== 'string' || token.trim() === '') return tokenRequired()
      result = await supabase
        .from('fcm_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token', token.trim())
    }

    if (result?.error)
      return NextResponse.json(
        { error: 'Failed to delete notification token' },
        { status: 500 }
      )

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
