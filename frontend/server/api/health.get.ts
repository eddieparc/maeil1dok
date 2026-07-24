import { useRuntimeConfig } from '#imports'
import { defineEventHandler, setResponseStatus } from 'h3'

type ApiBaseCheck = {
  status: 'ok' | 'warning' | 'error'
  configured: boolean
  public_origin?: string
  reason?: string
}

type InternalApiBaseCheck = {
  status: 'ok' | 'warning'
  configured: boolean
}

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:'])

// Read a nested config property without trusting inherited/prototype values.
const readNestedValue = (source: unknown, keys: string[]): unknown => {
  let current: unknown = source
  for (const key of keys) {
    if (typeof current !== 'object' || current === null) {
      return undefined
    }
    if (!Object.prototype.hasOwnProperty.call(current, key)) {
      return undefined
    }
    current = (current as Record<string, unknown>)[key]
  }
  return current
}

const normalizeConfigValue = (value: unknown): string =>
  typeof value === 'string' ? value.trim() : ''

const isLocalOrLoopbackHost = (hostname: string): boolean => {
  const host = hostname.toLowerCase()
  if (host === 'localhost' || host === 'localhost.') {
    return true
  }
  if (host === '0.0.0.0') {
    return true
  }
  if (host === '[::1]' || host === '::1') {
    return true
  }
  return host.startsWith('127.')
}

const isNonOriginUrl = (url: URL): boolean =>
  url.username !== '' ||
  url.password !== '' ||
  (url.pathname !== '' && url.pathname !== '/') ||
  url.search !== '' ||
  url.hash !== ''

const evaluateApiBase = (rawValue: unknown, isProduction: boolean): ApiBaseCheck => {
  const unsafeStatus = isProduction ? 'error' : 'warning'
  const value = normalizeConfigValue(rawValue)

  if (value === '') {
    return { status: unsafeStatus, configured: false, reason: 'blank' }
  }

  let url: URL
  try {
    url = new URL(value)
  } catch {
    return { status: unsafeStatus, configured: true, reason: 'malformed' }
  }

  if (!SUPPORTED_PROTOCOLS.has(url.protocol)) {
    return { status: unsafeStatus, configured: true, reason: 'unsupported_protocol' }
  }

  if (isNonOriginUrl(url)) {
    return { status: unsafeStatus, configured: true, reason: 'non_origin' }
  }

  if (isLocalOrLoopbackHost(url.hostname)) {
    return { status: unsafeStatus, configured: true, reason: 'local_or_loopback' }
  }

  return { status: 'ok', configured: true, public_origin: url.origin }
}

const evaluateInternalApiBase = (rawValue: unknown): InternalApiBaseCheck => {
  const configured = normalizeConfigValue(rawValue) !== ''
  return configured
    ? { status: 'ok', configured: true }
    : { status: 'warning', configured: false }
}

export default defineEventHandler((event) => {
  const isProduction = process.env.NODE_ENV === 'production'
  const config = useRuntimeConfig(event)

  const apiBase = evaluateApiBase(readNestedValue(config, ['public', 'apiBase']), isProduction)
  const internalApiBase = evaluateInternalApiBase(readNestedValue(config, ['internalApiBase']))

  let status: 'ok' | 'degraded' = 'ok'
  if (isProduction && apiBase.status === 'error') {
    status = 'degraded'
    setResponseStatus(event, 503)
  }

  return {
    status,
    service: 'maeil1dok-nuxt',
    checks: {
      runtime: { status: 'ok' },
      api_base: apiBase,
      internal_api_base: internalApiBase,
    },
  }
})
