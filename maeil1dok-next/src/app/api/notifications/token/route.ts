import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { token, deviceInfo } = await request.json()
    if (!token)
      return NextResponse.json({ error: 'Token required' }, { status: 400 })

    const { error } = await supabase.from('fcm_tokens').upsert(
      {
        user_id: user.id,
        token,
        device_info: deviceInfo ?? null,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'user_id,token' }
    )
    if (error)
      return NextResponse.json({ error: error.message }, { status: 500 })

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

    const { token } = await request.json()
    if (!token) {
      // Delete all tokens for user (logout)
      await supabase.from('fcm_tokens').delete().eq('user_id', user.id)
    } else {
      await supabase
        .from('fcm_tokens')
        .delete()
        .eq('user_id', user.id)
        .eq('token', token)
    }

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
