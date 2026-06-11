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
    status?: {
      privacyStatus?: string
    }
  }>
}

interface VideoCandidate {
  videoId: string
  title: string
  publishedAt: string
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

const getConfigValue = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

const decodeXml = (value: string): string => value.replace(
  /&(amp|lt|gt|quot|#39);/g,
  (entity) => XML_ENTITY_MAP[entity] || entity,
)

const getLatestVideosFromFeed = async (playlistId: string): Promise<VideoCandidate[]> => {
  const response = await fetch(`https://www.youtube.com/feeds/videos.xml?playlist_id=${playlistId}`)
  if (!response.ok) {
    throw new Error(`YouTube feed failed: ${response.status}`)
  }

  const xml = await response.text()
  const videos = [...xml.matchAll(/<entry\b[\s\S]*?<\/entry>/g)]
    .map((match) => {
      const entry = match[0]
      return {
        videoId: entry.match(/<yt:videoId>([^<]+)<\/yt:videoId>/)?.[1] || '',
        title: decodeXml(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || ''),
        publishedAt: entry.match(/<published>([^<]+)<\/published>/)?.[1] || '',
      }
    })
    .filter((video) => YOUTUBE_ID_PATTERN.test(video.videoId) && video.title.toLowerCase() !== 'private video')

  if (!videos.length) {
    throw new Error('Latest Hasena video was not found in feed')
  }

  return videos.slice(0, 5)
}

const getLatestVideosFromApi = async (config: ReturnType<typeof useRuntimeConfig>, playlistId: string): Promise<VideoCandidate[]> => {
  const apiKey = getConfigValue(config.youtubeApiKey) || getConfigValue(config.geminiApiKey)
  if (!apiKey) {
    throw new Error('YOUTUBE_API_KEY is not configured')
  }

  const params = new URLSearchParams({
    part: 'snippet,status',
    playlistId,
    maxResults: '10',
    key: apiKey,
  })
  const response = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${params}`)
  if (!response.ok) {
    throw new Error(`YouTube API failed: ${response.status}`)
  }

  const data = await response.json() as YouTubePlaylistResponse
  const videos = (data.items || [])
    .map((item) => ({
      videoId: item.snippet?.resourceId?.videoId || '',
      title: item.snippet?.title || '',
      publishedAt: item.snippet?.publishedAt || '',
      privacyStatus: item.status?.privacyStatus || '',
    }))
    .filter((video) => (
      YOUTUBE_ID_PATTERN.test(video.videoId)
      && video.title.toLowerCase() !== 'private video'
      && video.privacyStatus !== 'private'
    ))
    .map(({ videoId, title, publishedAt }) => ({ videoId, title, publishedAt }))

  if (!videos.length) {
    throw new Error('Latest Hasena video was not found')
  }

  return videos.slice(0, 5)
}

const getLatestVideos = async (config: ReturnType<typeof useRuntimeConfig>): Promise<VideoCandidate[]> => {
  const playlistId = getConfigValue(config.hasenaPlaylistId) || HASENA_PLAYLIST_ID
  try {
    return await getLatestVideosFromFeed(playlistId)
  } catch {
    return getLatestVideosFromApi(config, playlistId)
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
    const candidates = query.video_id
      ? [{ videoId: String(query.video_id), title: '', publishedAt: '' }]
      : await getLatestVideos(config)
    if (!candidates.every((candidate) => YOUTUBE_ID_PATTERN.test(candidate.videoId))) {
      setResponseStatus(event, 400)
      return { success: false, error: 'Invalid video_id' }
    }

    const configuredApiBase = getConfigValue(config.public.apiBase)
    const apiBase = configuredApiBase && !configuredApiBase.startsWith('http://localhost')
      ? configuredApiBase
      : 'https://api.maeil1dok.app'
    const callbackSecret = getConfigValue(config.hasenaCronSecret) || cronSecret

    const attempts = []
    for (const latest of candidates) {
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
      attempts.push({ latest, status: response.status, backend: body })

      if (response.ok && body.success) {
        return {
          success: true,
          latest,
          backend: body,
          attempts,
        }
      }
    }

    const lastAttempt = attempts.at(-1)
    setResponseStatus(event, lastAttempt?.status || 502)
    return { success: false, attempts }
  } catch (error) {
    setResponseStatus(event, 500)
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    }
  }
})
