import { createClient } from '@/lib/supabase/server'
import { createServerRepositories } from '@/repositories/factory'
import { NextResponse } from 'next/server'
import { z } from 'zod'

const MUTABLE_KEYS = [
  'theme',
  'fontFamily',
  'fontSize',
  'fontWeight',
  'lineHeight',
  'textAlign',
  'verseJoining',
  'showVerseNumbers',
  'showDescription',
  'showCrossRef',
  'highlightNames',
  'showFootnotes',
  'tongdokAutoComplete',
] as const

// Read-only response fields that BibleViewer echoes back in its full
// UserReadingSettings PATCH payload; accepted for compatibility but never
// forwarded to the repository.
const READ_ONLY_KEYS = ['id', 'userId', 'createdAt', 'updatedAt'] as const

const readOnlyShape = Object.fromEntries(
  READ_ONLY_KEYS.map((key) => [key, z.string().optional()])
) as Record<(typeof READ_ONLY_KEYS)[number], z.ZodOptional<z.ZodString>>

const readingSettingsPatchSchema = z
  .object({
    theme: z.enum(['light', 'dark', 'system']).optional(),
    fontFamily: z
      .enum([
        'ridi-batang',
        'noto-serif',
        'kopub-batang',
        'pretendard',
        'noto-sans',
        'system',
      ])
      .optional(),
    fontSize: z.number().int().min(14).max(24).optional(),
    fontWeight: z.enum(['normal', 'medium', 'bold']).optional(),
    lineHeight: z.number().finite().min(1.4).max(2.4).optional(),
    textAlign: z.enum(['left', 'justify']).optional(),
    verseJoining: z.boolean().optional(),
    showVerseNumbers: z.boolean().optional(),
    showDescription: z.boolean().optional(),
    showCrossRef: z.boolean().optional(),
    highlightNames: z.boolean().optional(),
    showFootnotes: z.boolean().optional(),
    tongdokAutoComplete: z.boolean().optional(),
    // Compatibility-only read-only fields (stripped before update).
    ...readOnlyShape,
  })
  .strict()
  .refine(
    (value) => MUTABLE_KEYS.some((key) => value[key] !== undefined),
    { message: 'At least one mutable reading setting is required' }
  )

export async function GET() {
  try {
    const supabase = await createClient()
    const repos = createServerRepositories(supabase)
    const user = await repos.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const settings = await repos.profile.getReadingSettings()
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
}

export async function PATCH(request: Request) {
  const supabase = await createClient()
  const repos = createServerRepositories(supabase)
  const user = await repos.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return NextResponse.json(
      { error: 'Invalid reading settings' },
      { status: 400 }
    )
  }

  const parsed = readingSettingsPatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid reading settings' },
      { status: 400 }
    )
  }

  const updates: Record<string, unknown> = {}
  for (const key of MUTABLE_KEYS) {
    const value = parsed.data[key]
    if (value !== undefined) updates[key] = value
  }

  try {
    const settings = await repos.profile.updateReadingSettings(updates)
    return NextResponse.json(settings)
  } catch {
    return NextResponse.json({ error: 'Failed to update' }, { status: 500 })
  }
}
