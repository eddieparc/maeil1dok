import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Database } from '@/lib/supabase/database.types'

type RecordInsert = Database['public']['Tables']['personal_reading_records']['Insert']

export async function GET(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const book = searchParams.get('book')
    const dateFrom = searchParams.get('date_from')
    const dateTo = searchParams.get('date_to')

    let query = supabase
      .from('personal_reading_records')
      .select('*')
      .eq('user_id', user.id)
      .order('read_date', { ascending: false })

    if (book) {
      query = query.eq('book', book)
    }

    if (dateFrom) {
      query = query.gte('read_date', dateFrom)
    }

    if (dateTo) {
      query = query.lte('read_date', dateTo)
    }

    const { data, error: queryError } = await query

    if (queryError) {
      return NextResponse.json({ error: 'Failed to load personal records' }, { status: 500 })
    }

    return NextResponse.json({ data })
  } catch {
    return NextResponse.json({ error: 'Failed to load personal records' }, { status: 500 })
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser()

    if (error || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = (await request.json()) as Partial<RecordInsert>
    const { book, chapter, read_date } = body

    if (!book || chapter === undefined || !read_date) {
      return NextResponse.json(
        { error: 'book, chapter, read_date are required' },
        { status: 400 }
      )
    }

    if (!Number.isInteger(chapter) || chapter <= 0) {
      return NextResponse.json({ error: 'chapter must be a positive integer' }, { status: 400 })
    }

    const insertData: RecordInsert = {
      user_id: user.id,
      book,
      chapter,
      read_date,
    }

    const { data, error: insertError } = await supabase
      .from('personal_reading_records')
      .insert(insertData)
      .select()
      .single()

    if (insertError) {
      if (insertError.code === '23505') {
        return NextResponse.json({ error: 'Record already exists for this book and chapter' }, { status: 409 })
      }
      return NextResponse.json({ error: 'Failed to create personal record' }, { status: 500 })
    }

    return NextResponse.json({ data }, { status: 201 })
  } catch {
    return NextResponse.json({ error: 'Failed to create personal record' }, { status: 500 })
  }
}
