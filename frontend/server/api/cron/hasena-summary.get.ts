import { useRuntimeConfig } from '#imports'
import { defineEventHandler, getHeader, getQuery, setResponseStatus } from 'h3'

interface HasenaSummaryCronPayload {
  readonly video_id?: string
  readonly video_date?: string
  readonly title?: string
}

const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

const getConfigValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const getQueryValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const getQueryProperty = (query: unknown, key: string): unknown => {
  if (!query || typeof query !== 'object') {
    return undefined
  }

  return Object.getOwnPropertyDescriptor(query, key)?.value
}

const buildCronPayload = (query: unknown): HasenaSummaryCronPayload => {
  const videoId = getQueryValue(getQueryProperty(query, 'video_id'))
  const videoDate = getQueryValue(getQueryProperty(query, 'video_date'))
  const title = getQueryValue(getQueryProperty(query, 'title'))

  return {
    ...(videoId ? { video_id: videoId } : {}),
    ...(videoDate ? { video_date: videoDate } : {}),
    ...(title ? { title } : {}),
  }
}

export default defineEventHandler(async (event) => {
  const config = useRuntimeConfig(event)
  const cronSecret = getConfigValue(config.cronSecret)
  const authHeader = getHeader(event, 'authorization')
  const query = getQuery(event)
  const token = typeof query.token === 'string' ? query.token : ''

  if (!cronSecret) {
    setResponseStatus(event, 503)
    return { success: false, error: 'CRON_SECRET is not configured' }
  }

  if (authHeader !== `Bearer ${cronSecret}` && token !== cronSecret) {
    setResponseStatus(event, 401)
    return { success: false, error: 'Unauthorized' }
  }

  try {
    const payload = buildCronPayload(query)
    if (payload.video_id && !YOUTUBE_ID_PATTERN.test(payload.video_id)) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Invalid video_id' }
    }

    const configuredApiBase = getConfigValue(config.public.apiBase)
    const apiBase = configuredApiBase && !configuredApiBase.startsWith('http://localhost')
      ? configuredApiBase
      : 'https://api.maeil1dok.app'
    const callbackSecret = getConfigValue(config.hasenaCronSecret) || cronSecret

    const response = await fetch(`${apiBase}/api/v1/todos/hasena/summary/cron/`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(callbackSecret ? { 'X-Cron-Secret': callbackSecret } : {}),
      },
      body: JSON.stringify(payload),
    })
    const body = await response.json().catch(() => ({}))
    const attempts = [{ status: response.status, backend: body }]

    if (response.ok && body.success) {
      return {
        success: true,
        backend: body,
        attempts,
      }
    }

    setResponseStatus(event, response.status || 502)
    return { success: false, attempts }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
