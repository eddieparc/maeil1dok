const HASENA_PLAYLIST_ID = 'PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL' as const
const YOUTUBE_FEED_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${HASENA_PLAYLIST_ID}` as const
const YOUTUBE_PLAYLIST_URL = `https://www.youtube.com/playlist?list=${HASENA_PLAYLIST_ID}` as const
const YOUTUBE_VIDEO_ID_PATTERN = /^[A-Za-z0-9_-]{11}$/

type LatestHasenaVideo = {
  readonly videoId: string
  readonly title: string | null
  readonly publishedAt: string | null
}

type HasenaVideoEvent = {
  readonly event: string
  readonly source: 'youtube_xml_feed' | 'youtube_playlist_html'
  readonly fallback?: 'youtube_playlist_html'
  readonly status?: number
  readonly statusText?: string
  readonly foundVideo?: boolean
}

const reportHasenaVideoEvent = async (
  level: 'warning' | 'error',
  details: HasenaVideoEvent,
): Promise<void> => {
  const payload = {
    service: 'hasena_latest_video',
    ...details,
  }
  const serializedPayload = JSON.stringify(payload)

  if (level === 'error') {
    console.error(serializedPayload)
  } else {
    console.warn(serializedPayload)
  }

  if (level === 'error') {
    try {
      const Sentry = await import('@sentry/nuxt')
      if (typeof Sentry.captureMessage === 'function') {
        Sentry.captureMessage(details.event, {
          level,
          extra: payload,
        })
      }
    } catch (error) {
      if (error instanceof Error) {
        return
      }

      throw error
    }
  }
}

const extractXmlText = (xml: string, tagName: string): string | null => {
  const pattern = new RegExp(`<${tagName}>([^<]+)</${tagName}>`)
  const match = xml.match(pattern)

  return match?.[1] ? decodeXmlEntities(match[1]) : null
}

const decodeXmlEntities = (value: string): string => {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
}

const decodeJsonString = (value: string): string => {
  try {
    const parsed = JSON.parse(`"${value}"`)

    return typeof parsed === 'string' ? parsed : value
  } catch (error) {
    if (error instanceof SyntaxError) {
      return value
        .replace(/\\"/g, '"')
        .replace(/\\u0026/g, '&')
    }

    throw error
  }
}

const extractYoutubeHtmlTitle = (html: string): string | null => {
  const match = html.match(/"title"\s*:\s*\{\s*"runs"\s*:\s*\[\s*\{\s*"text"\s*:\s*"((?:\\.|[^"\\])*)"/)
    ?? html.match(/"title"\s*:\s*\{\s*"simpleText"\s*:\s*"((?:\\.|[^"\\])*)"/)
  const title = match?.[1] ? decodeJsonString(match[1]).trim() : ''

  return title || null
}

const extractPlaylistHtmlVideo = (html: string): LatestHasenaVideo | null => {
  for (const match of html.matchAll(/"(?:playlistVideoRenderer|videoRenderer)"\s*:\s*\{/g)) {
    const segmentStart = match.index ?? 0
    const segment = html.slice(segmentStart, segmentStart + 6000)
    const videoId = segment.match(/"videoId"\s*:\s*"([A-Za-z0-9_-]{11})"/)?.[1]
    if (!videoId || !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
      continue
    }

    const title = extractYoutubeHtmlTitle(segment)
    if (!title || title.toLowerCase() === 'private video' || title.toLowerCase() === 'deleted video') {
      continue
    }

    return {
      videoId,
      title,
      publishedAt: null,
    }
  }

  const fallbackVideoId = html.match(/i\.ytimg\.com\/vi\/([A-Za-z0-9_-]{11})\//)?.[1]

  return fallbackVideoId && YOUTUBE_VIDEO_ID_PATTERN.test(fallbackVideoId)
    ? {
        videoId: fallbackVideoId,
        title: null,
        publishedAt: null,
      }
    : null
}

const fetchLatestVideoFromPlaylistHtml = async (feedResponse: Response): Promise<LatestHasenaVideo> => {
  await reportHasenaVideoEvent('warning', {
    event: 'hasena_latest_video_xml_feed_unavailable',
    source: 'youtube_xml_feed',
    fallback: 'youtube_playlist_html',
    status: feedResponse.status,
    statusText: feedResponse.statusText,
  })

  const response = await fetch(YOUTUBE_PLAYLIST_URL, {
    headers: {
      accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8',
      'user-agent': 'maeil1dok/hasena-summary',
    },
  })

  if (!response.ok) {
    await reportHasenaVideoEvent('error', {
      event: 'hasena_latest_video_playlist_html_unavailable',
      source: 'youtube_playlist_html',
      status: response.status,
      statusText: response.statusText,
    })

    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to load latest Hasena video',
    })
  }

  const video = extractPlaylistHtmlVideo(await response.text())

  if (!video) {
    await reportHasenaVideoEvent('error', {
      event: 'hasena_latest_video_playlist_html_missing_public_video',
      source: 'youtube_playlist_html',
      status: response.status,
      statusText: response.statusText,
      foundVideo: false,
    })

    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to load latest Hasena video',
    })
  }

  await reportHasenaVideoEvent('warning', {
    event: 'hasena_latest_video_playlist_html_fallback_succeeded',
    source: 'youtube_playlist_html',
    status: response.status,
    foundVideo: true,
  })

  return video
}

export default defineEventHandler(async () => {
  const response = await fetch(YOUTUBE_FEED_URL, {
    headers: {
      accept: 'application/atom+xml, application/xml;q=0.9, */*;q=0.8',
      'user-agent': 'maeil1dok/hasena-summary',
    },
  })

  if (!response.ok) {
    return fetchLatestVideoFromPlaylistHtml(response)
  }

  const xml = await response.text()
  const firstEntry = xml.match(/<entry>[\s\S]*?<\/entry>/)?.[0]

  if (!firstEntry) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Latest Hasena video not found',
    })
  }

  const videoId = extractXmlText(firstEntry, 'yt:videoId')

  if (!videoId) {
    throw createError({
      statusCode: 404,
      statusMessage: 'Latest Hasena video ID not found',
    })
  }

  return {
    videoId,
    title: extractXmlText(firstEntry, 'title'),
    publishedAt: extractXmlText(firstEntry, 'published'),
  }
})
