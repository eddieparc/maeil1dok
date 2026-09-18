import { useRuntimeConfig } from 'nuxt/app';
import {
  checkCacheServerAvailable as checkCacheServer,
  fetchFromCacheServer as fetchCachedChapter,
  fetchKntContentWithCache,
  fetchStandardContentWithCache,
  type BibleFetchResult,
} from './bible/bibleFetchClient';

export function useBibleFetch() {
  const config = useRuntimeConfig();
  const bibleCacheUrl = String(config.public.bibleCacheUrl || '');

  async function fetchKntContent(
    book: string,
    chapter: number,
  ): Promise<BibleFetchResult> {
    return fetchKntContentWithCache(bibleCacheUrl, book, chapter);
  }

  async function fetchStandardContent(
    version: string,
    book: string,
    chapter: number,
  ): Promise<BibleFetchResult> {
    return fetchStandardContentWithCache(bibleCacheUrl, version, book, chapter);
  }

  async function fetchFromCacheServer(
    version: string,
    book: string,
    chapter: number,
  ): Promise<BibleFetchResult> {
    return fetchCachedChapter(bibleCacheUrl, version, book, chapter);
  }

  async function checkCacheServerAvailable(): Promise<boolean> {
    return checkCacheServer(bibleCacheUrl);
  }

  function getFallbackUrl(version: string, book: string, chapter: number): string {
    if (version === 'KNT') {
      return `https://www.bskorea.or.kr/KNT/index.php?chapter=${book.toUpperCase()}.${chapter}`;
    }
    return `https://www.bskorea.or.kr/bible/korbibReadpage.php?version=${version}&book=${book}&chap=${chapter}`;
  }

  return {
    fetchKntContent,
    fetchStandardContent,
    fetchFromCacheServer,
    checkCacheServerAvailable,
    getFallbackUrl,
  };
}
