/**
 * 통독 모드 오디오 링크 선택
 *
 * 플랜 일정에 오디오가 있으면 그것을 쓰고, 없으면 백엔드가 내려준
 * 장별 폴백(@readingjesus 장별 성경읽기 영상)에서 현재 장의 링크를 고른다.
 */
import type { components } from '~/types/generated/api-schema';

export type ChapterFallbackAudioLink = components['schemas']['ChapterFallbackAudioLink'];

export interface TongdokAudioSelectionInput {
  audioLink?: string | null;
  fallbackLinks?: ChapterFallbackAudioLink[] | null;
  book?: string | null;
  chapter?: number | string | null;
}

export const selectTongdokAudioLink = ({
  audioLink,
  fallbackLinks,
  book,
  chapter,
}: TongdokAudioSelectionInput): string | null => {
  if (audioLink) {
    return audioLink;
  }

  if (!fallbackLinks?.length || !book) {
    return null;
  }

  const chapterNumber = Number(chapter);
  if (!Number.isFinite(chapterNumber)) {
    return null;
  }

  const match = fallbackLinks.find(
    link => link.book === book && link.chapter === chapterNumber
  );

  return match?.url ?? null;
};
