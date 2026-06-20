const HASENA_PLAYLIST_ID = 'PLMT1AJszhYtXkV936HNuExxjAmtFhp2tL' as const
const YOUTUBE_FEED_URL = `https://www.youtube.com/feeds/videos.xml?playlist_id=${HASENA_PLAYLIST_ID}` as const

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

export default defineEventHandler(async () => {
  const response = await fetch(YOUTUBE_FEED_URL, {
    headers: {
      accept: 'application/atom+xml, application/xml;q=0.9, */*;q=0.8',
      'user-agent': 'maeil1dok/hasena-summary',
    },
  })

  if (!response.ok) {
    throw createError({
      statusCode: 502,
      statusMessage: 'Failed to load latest Hasena video',
    })
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
