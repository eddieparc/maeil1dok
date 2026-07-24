import { NextResponse } from 'next/server'

type ParseJsonBodyResult<T> =
  | { ok: true; body: T }
  | { ok: false; response: NextResponse }

export async function parseJsonBody<T>(request: Request): Promise<ParseJsonBodyResult<T>> {
  try {
    const body = (await request.json()) as T
    return { ok: true, body }
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 }),
    }
  }
}
