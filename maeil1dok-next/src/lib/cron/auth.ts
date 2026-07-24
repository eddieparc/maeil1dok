import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'node:crypto'

/**
 * Constant-time string comparison.
 *
 * Both inputs are hashed to a fixed-length SHA-256 digest before comparison so
 * that `timingSafeEqual` never throws on length mismatch and the running time
 * does not leak the length or content of the configured secret.
 */
function constantTimeEquals(a: string, b: string): boolean {
  const digestA = createHash('sha256').update(a, 'utf8').digest()
  const digestB = createHash('sha256').update(b, 'utf8').digest()
  return timingSafeEqual(digestA, digestB)
}

/**
 * Authorize a Vercel cron (or equivalent internal scheduler) request.
 *
 * Mirrors the Django backend's `_cron_secret_error` contract:
 *   - Returns a `NextResponse` describing the failure, or `null` when the
 *     request is authorized.
 *   - Deny-by-default: when `CRON_SECRET` is not configured the endpoint is
 *     unavailable (503) rather than accepting requests. This prevents the
 *     fail-open case where an unset env var made `Bearer undefined` a valid
 *     credential.
 *   - Uses a constant-time comparison to avoid leaking the secret via timing.
 */
export function cronAuthError(request: Request): NextResponse | null {
  const configured = process.env.CRON_SECRET

  if (!configured) {
    return NextResponse.json(
      { error: 'CRON_SECRET is not configured' },
      { status: 503 }
    )
  }

  const authHeader = request.headers.get('authorization')
  if (!authHeader || !constantTimeEquals(authHeader, `Bearer ${configured}`)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return null
}
