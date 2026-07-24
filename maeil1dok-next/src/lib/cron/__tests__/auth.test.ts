import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { cronAuthError } from '@/lib/cron/auth'

const ORIGINAL_SECRET = process.env.CRON_SECRET

function requestWithAuth(header?: string): Request {
  return new Request('http://localhost/api/cron/test', {
    method: 'GET',
    headers: header !== undefined ? { authorization: header } : {},
  })
}

describe('cronAuthError — cron endpoint authorization', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 'super-secret-value'
  })

  afterEach(() => {
    if (ORIGINAL_SECRET === undefined) {
      delete process.env.CRON_SECRET
    } else {
      process.env.CRON_SECRET = ORIGINAL_SECRET
    }
  })

  it('authorizes a request carrying the correct bearer secret', () => {
    const result = cronAuthError(requestWithAuth('Bearer super-secret-value'))
    expect(result).toBeNull()
  })

  it('rejects a request with a wrong secret (401)', async () => {
    const result = cronAuthError(requestWithAuth('Bearer wrong-value'))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
    await expect(result!.json()).resolves.toEqual({ error: 'Unauthorized' })
  })

  it('rejects a request with no authorization header (401)', () => {
    const result = cronAuthError(requestWithAuth())
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('rejects a bare-token header without the Bearer prefix', () => {
    const result = cronAuthError(requestWithAuth('super-secret-value'))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })

  it('fails closed with 503 when CRON_SECRET is not configured', async () => {
    delete process.env.CRON_SECRET
    const result = cronAuthError(requestWithAuth('Bearer anything'))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(503)
    await expect(result!.json()).resolves.toEqual({
      error: 'CRON_SECRET is not configured',
    })
  })

  it('does NOT accept the literal "Bearer undefined" when the secret is unset', () => {
    // Regression: `Bearer ${process.env.CRON_SECRET}` stringified an unset env
    // var to "Bearer undefined", which an attacker could send verbatim.
    delete process.env.CRON_SECRET
    const result = cronAuthError(requestWithAuth('Bearer undefined'))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(503)
  })

  it('does NOT accept the literal "Bearer " when the secret is an empty string', () => {
    process.env.CRON_SECRET = ''
    const result = cronAuthError(requestWithAuth('Bearer '))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(503)
  })

  it('rejects a secret that is a prefix of the configured value', () => {
    const result = cronAuthError(requestWithAuth('Bearer super-secret'))
    expect(result).not.toBeNull()
    expect(result!.status).toBe(401)
  })
})
