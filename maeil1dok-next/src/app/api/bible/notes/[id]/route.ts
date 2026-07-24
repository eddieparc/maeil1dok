import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJsonBody } from '@/lib/api/parseJsonBody'
import type { Database } from '@/lib/supabase/database.types'

type NoteUpdate = Database['public']['Tables']['reflection_notes']['Update']

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function isPositiveInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value > 0
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { data, error: queryError } = await supabase
      .from('reflection_notes')
      .select('*')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (queryError || !data) {
      return NextResponse.json({ error: 'Note not found' }, { status: 404 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Failed to load note' }, { status: 500 })
  }
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const parseResult = await parseJsonBody<unknown>(request)
    if (!parseResult.ok) {
      return parseResult.response
    }

    const body = parseResult.body
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Request body must be an object' }, { status: 400 })
    }

    const { content, is_private, start_verse, end_verse } = body

    const updateData: NoteUpdate = {}

    if (content !== undefined) {
      if (!isNonEmptyString(content)) {
        return NextResponse.json({ error: 'content must be a non-empty string' }, { status: 400 })
      }
      updateData.content = content
    }

    if (is_private !== undefined) {
      if (typeof is_private !== 'boolean') {
        return NextResponse.json({ error: 'is_private must be a boolean' }, { status: 400 })
      }
      updateData.is_private = is_private
    }

    if (start_verse !== undefined || end_verse !== undefined) {
      const bothNull = start_verse === null && end_verse === null
      const bothPositive =
        isPositiveInteger(start_verse) &&
        isPositiveInteger(end_verse) &&
        end_verse >= start_verse

      if (!bothNull && !bothPositive) {
        return NextResponse.json(
          { error: 'start_verse and end_verse must both be null or positive ordered integers' },
          { status: 400 }
        )
      }

      updateData.start_verse = start_verse as number | null
      updateData.end_verse = end_verse as number | null
    }

    updateData.updated_at = new Date().toISOString()

    const { data, error: updateError } = await supabase
      .from('reflection_notes')
      .update(updateData)
      .eq('id', id)
      .eq('user_id', user.id)
      .select()
      .single()

    if (updateError || !data) {
      return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Failed to update note' }, { status: 500 })
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    const { error: deleteError } = await supabase
      .from('reflection_notes')
      .delete()
      .eq('id', id)
      .eq('user_id', user.id)

    if (deleteError) {
      return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: 'Failed to delete note' }, { status: 500 })
  }
}
