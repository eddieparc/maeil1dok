import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const notificationSettingsPatchSchema = z.object({
  daily_reminder_enabled: z.boolean().optional(),
  daily_reminder_time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/).optional(),
  hasena_notification_enabled: z.boolean().optional(),
  friend_activity_enabled: z.boolean().optional(),
  push_enabled: z.boolean().optional(),
}).strict()

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    // Get or create default settings
    const { data: existing, error: selectError } = await supabase
      .from('notification_settings')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    if (selectError)
      return NextResponse.json(
        { error: 'Failed to load notification settings' },
        { status: 500 }
      )

    if (existing) return NextResponse.json(existing)

    // Create defaults only when the lookup succeeded and confirmed no row
    const { data: created, error } = await supabase
      .from('notification_settings')
      .insert({ user_id: user.id })
      .select()
      .single()

    if (error)
      return NextResponse.json(
        { error: 'Failed to load notification settings' },
        { status: 500 }
      )
    if (!created)
      return NextResponse.json(
        { error: 'Failed to load notification settings' },
        { status: 500 }
      )
    return NextResponse.json(created)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: 'Invalid notification settings' },
        { status: 400 }
      )
    }

    const parsed = notificationSettingsPatchSchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid notification settings' },
        { status: 400 }
      )
    }

    const { data, error } = await supabase
      .from('notification_settings')
      .upsert(
        {
          ...parsed.data,
          user_id: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: 'user_id' }
      )
      .select()
      .single()

    if (error)
      return NextResponse.json(
        { error: 'Failed to update notification settings' },
        { status: 500 }
      )
    return NextResponse.json(data)
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
