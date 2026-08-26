export type BibleFetchSource = 'proxy' | 'cache' | 'error';

export type BibleContentType = 'html' | 'json';

export type BibleFetchResult = {
  readonly content: string;
  readonly contentType: BibleContentType;
  readonly fromCache: boolean;
  readonly source: BibleFetchSource;
};

type BibleCacheResponse = {
  readonly success: boolean;
  readonly data?: {
    readonly content: string;
    readonly content_type: BibleContentType;
    readonly from_cache?: boolean;
  };
  readonly error?: string;
};

const PROXY_SLOW_FALLBACK_TIMEOUT = 3500;
const CACHE_TIMEOUT = 15000;

export async function fetchKntContentWithCache(
  bibleCacheUrl: string,
  book: string,
  chapter: number,
): Promise<BibleFetchResult> {
  return fetchWithCacheFallback({
    bibleCacheUrl,
    version: 'KNT',
    book,
    chapter,
    contentType: 'json',
    proxyFetch: () => fetchKntFromProxy(book, chapter),
  });
}

export async function fetchStandardContentWithCache(
  bibleCacheUrl: string,
  version: string,
  book: string,
  chapter: number,
): Promise<BibleFetchResult> {
  return fetchWithCacheFallback({
    bibleCacheUrl,
    version,
    book,
    chapter,
    contentType: 'html',
    proxyFetch: () => fetchStandardFromProxy(version, book, chapter),
  });
}

export async function fetchWooriContentFromCache(
  bibleCacheUrl: string,
  book: string,
  chapter: number,
): Promise<BibleFetchResult> {
  if (!bibleCacheUrl) {
    return errorResult('json');
  }

  try {
    return await fetchFromCacheServer(bibleCacheUrl, 'WOORI', book, chapter);
  } catch (error) {
    console.error('[BibleFetch] WOORI cache failed:', formatUnknownError(error));
    return errorResult('json');
  }
}

export async function fetchFromCacheServer(
  bibleCacheUrl: string,
  version: string,
  book: string,
  chapter: number,
): Promise<BibleFetchResult> {
  if (!bibleCacheUrl) {
    throw new Error('Cache server URL not configured');
  }

  const response = await fetchWithTimeout(
    `${bibleCacheUrl}/api/v1/bible-cache/${version}/${book}/${chapter}/`,
    CACHE_TIMEOUT,
    { headers: { Accept: 'application/json' } },
  );

  if (!response.ok) {
    throw new Error(`Cache server error: ${response.status}`);
  }

  const data = parseBibleCacheResponse(await response.json());
  if (!data.success || !data.data) {
    throw new Error(data.error || 'Cache server returned error');
  }

  return {
    content: data.data.content,
    contentType: data.data.content_type,
    fromCache: data.data.from_cache ?? true,
    source: 'cache',
  };
}

export async function checkCacheServerAvailable(bibleCacheUrl: string): Promise<boolean> {
  if (!bibleCacheUrl) {
    return false;
  }

  try {
    const response = await fetchWithTimeout(
      `${bibleCacheUrl}/api/v1/bible-cache/versions/`,
      5000,
      { method: 'GET' },
    );
    return response.ok;
  } catch (error) {
    console.warn('[BibleFetch] cache availability check failed:', formatUnknownError(error));
    return false;
  }
}

type FallbackOptions = {
  readonly bibleCacheUrl: string;
  readonly version: string;
  readonly book: string;
  readonly chapter: number;
  readonly contentType: BibleContentType;
  readonly proxyFetch: () => Promise<BibleFetchResult>;
};

async function fetchWithCacheFallback(options: FallbackOptions): Promise<BibleFetchResult> {
  if (options.bibleCacheUrl) {
    try {
      return await fetchFromCacheServer(
        options.bibleCacheUrl,
        options.version,
        options.book,
        options.chapter,
      );
    } catch (cacheError) {
      console.warn('[BibleFetch] cache first attempt failed:', formatUnknownError(cacheError));
    }
  }

  try {
    return await options.proxyFetch();
  } catch (proxyError) {
    console.warn('[BibleFetch] proxy slow or failed:', formatUnknownError(proxyError));
  }

  if (options.bibleCacheUrl) {
    try {
      return await fetchFromCacheServer(
        options.bibleCacheUrl,
        options.version,
        options.book,
        options.chapter,
      );
    } catch (cacheError) {
      console.error('[BibleFetch] cache fallback failed:', formatUnknownError(cacheError));
    }
  }

  return errorResult(options.contentType);
}

export function buildKntProxyUrl(book: string, chapter: number): string {
  const params = new URLSearchParams({
    version: 'd7a4326402395391-01',
    chapter: `${book.toUpperCase()}.${chapter}`,
  });
  return `/bible-proxy/KNT/get_chapter.php?${params.toString()}`;
}

async function fetchKntFromProxy(book: string, chapter: number): Promise<BibleFetchResult> {
  const response = await fetchWithTimeout(
    buildKntProxyUrl(book, chapter),
    PROXY_SLOW_FALLBACK_TIMEOUT,
  );

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const jsonData = await response.json();
  if (!hasFoundFlag(jsonData)) {
    throw new Error('Content not found');
  }

  return {
    content: JSON.stringify(jsonData),
    contentType: 'json',
    fromCache: false,
    source: 'proxy',
  };
}

export function buildStandardProxyUrl(
  version: string,
  book: string,
  chapter: number,
): string {
  const params = new URLSearchParams({
    version,
    book,
    chap: String(chapter),
    cVersion: '',
    fontSize: '15px',
    fontWeight: 'normal',
  });
  return `/bible-proxy/bible/korbibReadpage.php?${params.toString()}`;
}

async function fetchStandardFromProxy(
  version: string,
  book: string,
  chapter: number,
): Promise<BibleFetchResult> {
  const response = await fetchWithTimeout(
    buildStandardProxyUrl(version, book, chapter),
    PROXY_SLOW_FALLBACK_TIMEOUT,
  );

  if (!response.ok) {
    throw new Error(`HTTP error: ${response.status}`);
  }

  const text = await response.text();
  if (text.length < 100) {
    throw new Error('Empty or invalid response');
  }

  return {
    content: text,
    contentType: 'html',
    fromCache: false,
    source: 'proxy',
  };
}

async function fetchWithTimeout(
  url: string,
  timeoutMs: number,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timeoutId);
  }
}

function errorResult(contentType: BibleContentType): BibleFetchResult {
  return {
    content: '',
    contentType,
    fromCache: false,
    source: 'error',
  };
}

function formatUnknownError(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function parseBibleCacheResponse(value: unknown): BibleCacheResponse {
  if (!isRecord(value)) {
    return { success: false, error: 'Invalid cache response' };
  }

  const data = value.data;
  if (!isRecord(data)) {
    return {
      success: value.success === true,
      error: typeof value.error === 'string' ? value.error : undefined,
    };
  }

  const contentType = data.content_type;
  if (typeof data.content !== 'string' || !isBibleContentType(contentType)) {
    return { success: false, error: 'Invalid cache data' };
  }

  return {
    success: value.success === true,
    data: {
      content: data.content,
      content_type: contentType,
      from_cache: typeof data.from_cache === 'boolean' ? data.from_cache : undefined,
    },
    error: typeof value.error === 'string' ? value.error : undefined,
  };
}

function hasFoundFlag(value: unknown): boolean {
  return isRecord(value) && value.found === true;
}

function isBibleContentType(value: unknown): value is BibleContentType {
  return value === 'html' || value === 'json';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}
