import { useRuntimeConfig } from '#imports'
import { defineEventHandler, getHeader, getQuery, setResponseStatus } from 'h3'

interface YouTubePlaylistResponse {
  items?: Array<{
    snippet?: {
      title?: string
      publishedAt?: string
      resourceId?: {
        videoId?: string
      }
    }
  }>
}

const HASENA_PLAYLIST_ID = 'PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL'
const YOUTUBE_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/
const XML_ENTITY_MAP: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
}

const getConfigValue = (value: unknown): string => (typeof value === 'string' ? value : '')

const decodeXml = (value: string): string => value.replace(
  /&(amp|lt|gt|quot|#39);/g,
  (entity) => XML_ENTITY_MAP[entity] || entity,
)

const getLatestVideoFromFeed = async (playlistId: string) => {
  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`)
  if (!response.ok) {
    throw new Error(`YouTube feed failed: ${response.status}`)
  }

  const xml = await response.text()
  const entry = xml.match(/<entry\b[\s\S]*?<\/entry>/)?.[0] || ''
  const videoId = entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || ''
  if (!videoId) {
    throw new Error('Latest Hasena video was not found in feed')
  }

  return {
    videoId,
    title: decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || ''),
    publishedAt: entry.match(/<published>([^<]+)<\/published>/)?.[1] || '',
  }
}

const getLatestVideoFromApi = async (config: ReturnType<typeof useRuntimeConfig>, playlistId: string) => {
  const apiKey = getConfigValue(config.youtubeApiKey) || getConfigValue(config.geminiApiKey)
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not configured')
  }

  const params = new URLSearchParams({
    part: 'snippet',
    playlistId,
    maxResults: '1',
    key: apiKey,
  })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`)
  if (!response.ok) {
    throw new Error(`YouTube API failed: ${response.status}`)
  }

  const data = await response.json() as YouTubePlaylistResponse
  const snippet = data.items?.[0]?.snippet
  const videoId = snippet?.resourceId?.videoId
  if (!videoId) {
    throw new Error('Latest Hasena video was not found')
  }

  return {
    videoId,
    title: snippet?.title || '',
    publishedAt: snippet?.publishedAt || '',
  }
}

const getLatestVideo = async (config: ReturnType<typeof useRuntimeConfig>) => {
  const playlistId = getConfigValue(config.hasenaPlaylistId) || HASENA_PLAYLIST_ID
  try {
    return await getLatestVideoFromFeed(playlistId)
  } catch {
    return getLatestVideoFromApi(config, playlistId)
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
    const latest = query.video_id
      ? { videoId: String(query.video_id), title: '', publishedAt: '' }
      : await getLatestVideo(config)
    if (!YOUTUBE_ID_PATTERN.test(latest.videoId)) {
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
      body: JSON.stringify({
        video_id: latest.videoId,
        video_date: new Date().toISOString().slice(0, 10),
        title: latest.title,
      }),
    })
    const body = await response.json().catch(() => ({}))

    if (!response.ok || !body.success) {
      setResponseStatus(event, response.ok ? 502 : response.status)
      return {
        success: false,
        status: response.status,
        latest,
        backend: body,
      }
    }

    return {
      success: true,
      latest,
      backend: body,
    }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
