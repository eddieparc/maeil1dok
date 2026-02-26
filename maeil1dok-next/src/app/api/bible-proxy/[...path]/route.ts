import { NextRequest, NextResponse } from 'next/server'

const TARGET_URLS: Record<string, string> = {
  'KNT': 'https://bskorea.or.kr/KNT',
  'bible': 'https://bskorea.or.kr/bible',
  'hasena': 'https://xn--910b782abhbh7k53rca.kr/bbs',
}

export async function GET(
  request: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const [prefix, ...rest] = params.path
  const baseUrl = TARGET_URLS[prefix]

  if (!baseUrl) {
    return NextResponse.json({ error: 'Invalid proxy path' }, { status: 400 })
  }

  // Construct target URL preserving query params
  const targetPath = rest.join('/')
  const searchParams = request.nextUrl.searchParams.toString()
  const targetUrl = `${baseUrl}/${targetPath}${searchParams ? '?' + searchParams : ''}`

  try {
    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0',
        'Accept': 'text/html,application/xhtml+xml',
        'Accept-Language': 'ko-KR,ko',
      },
      next: { revalidate: 86400 }, // 24h cache
    })

    const content = await response.text()

    return new NextResponse(content, {
      status: response.status,
      headers: {
        'Content-Type': response.headers.get('Content-Type') || 'text/html',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
      },
    })
  } catch (error) {
    return NextResponse.json(
      { error: 'Failed to fetch Bible content' },
      { status: 502 }
    )
  }
}
