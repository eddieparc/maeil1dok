import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// GET: Kakao and Google redirect here
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`)
    }
    
    // Handle error cases
    if (next !== '/') {
      // This was an identity linking flow — redirect back to settings with error
      const errorParam = error.message?.includes('already') || error.message?.includes('linked')
        ? 'identity_already_linked'
        : 'link_failed'
      return NextResponse.redirect(`${origin}${next}?error=${errorParam}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}

// POST: Apple Sign In sends POST (not GET)
export async function POST(request: NextRequest) {
  const { origin } = new URL(request.url)

  try {
    const formData = await request.formData()
    const code = formData.get('code') as string | null

    if (code) {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)
      if (!error) {
        return NextResponse.redirect(`${origin}/`)
      }
    }
  } catch {
    // Apple may send in different format
  }

  return NextResponse.redirect(`${origin}/login?error=auth`)
}
