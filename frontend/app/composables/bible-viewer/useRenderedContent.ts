import { computed } from 'vue';
import { useSanitize } from '~/composables/useSanitize';
import type { Highlight, ResolvedViewerProps } from './types';

// 본문 HTML 렌더 파이프라인: 절 번호 클릭 속성 주입 + 하이라이트 적용 + sanitize.
// renderedContent는 props.content/highlights의 순수 computed로 유지한다 —
// 부모가 exit 애니메이션 동안 content를 고정하면 v-html이 재생성되지 않는다.
export function useRenderedContent(props: ResolvedViewerProps) {
  const { sanitize } = useSanitize();

  // 특정 절의 하이라이트 찾기
  const getHighlightForVerse = (verseNum: number): Highlight | undefined => {
    return props.highlights.find(
      h => verseNum >= h.start_verse && verseNum <= h.end_verse
    );
  };

  const hasErrorContent = computed(() => props.content.includes('class="error-message"'));

  // 본문 렌더링 (절 번호에 data-verse 속성 추가 + 하이라이트 적용)
  const renderedContent = computed(() => {
    if (!props.content) return '';

    // sup 태그에 클릭 가능한 클래스와 data-verse 추가
    let content = props.content.replace(
      /<sup>(\d+)<\/sup>/g,
      '<sup class="verse-num" data-verse="$1">$1</sup>'
    );

    // 기존 절 번호 스타일 개선
    content = content.replace(
      /<sup class="verse-num"/g,
      '<sup class="verse-num clickable"'
    );

    // 하이라이트가 있으면 절에 배경색 적용
    if (props.highlights.length > 0) {
      // .verse 요소에 하이라이트 적용 (verse-number에서 절 번호 추출)
      content = content.replace(
        /<div class="(verse(?: [^"]*)?)">(\s*(?:<div class="verse-line[^"]*">\s*)?<span class="verse-number">(\d+)<\/span>)/g,
        (match, classes, prefix, verseNum) => {
          const highlight = getHighlightForVerse(parseInt(verseNum));
          if (highlight) {
            // 배경색을 직접 지정하지 않고 CSS 변수로 전달하여 투명도 조절 가능하게 함
            return `<div class="${classes} highlighted" data-highlight-id="${highlight.id}" style="--highlight-bg: ${highlight.color}">${prefix}`;
          }
          return match;
        }
      );
    }

    return sanitize(content);
  });

  return { renderedContent, hasErrorContent };
}
