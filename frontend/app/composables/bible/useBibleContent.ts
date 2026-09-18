/**
 * useBibleContent - Bible 본문 콘텐츠 로딩 및 파싱 로직
 *
 * 성경 본문을 외부 API에서 가져와 파싱하고 렌더링 가능한 HTML로 변환합니다.
 * KNT(새한글성경)와 표준 역본(개역개정 등)에 대해 각각 다른 파싱 로직을 적용합니다.
 *
 * @example
 * const { content, isLoading, loadContent } = useBibleContent();
 *
 * // 콘텐츠 로드
 * await loadContent('gen', 1, 'GAE');
 *
 * // 렌더링
 * <div v-html="content" />
 */

import { ref, type Ref } from 'vue';
import { useBibleFetch } from '~/composables/useBibleFetch';
import { useBibleData } from '~/composables/useBibleData';
import { useReadingSettingsStore } from '~/stores/readingSettings';

/**
 * useBibleContent 반환 타입
 */
export interface UseBibleContentReturn {
  // 상태
  content: Ref<string>;
  chapterTitle: Ref<string>;
  isLoading: Ref<boolean>;
  error: Ref<Error | null>;

  // 액션
  loadContent: (book: string, chapter: number, version: string) => Promise<void>;
  clearContent: () => void;
}

// 구절 데이터 타입
interface VerseLine {
  text: string;
  class: string;
}

interface VerseData {
  lines: VerseLine[];
  order: number;
}

interface ContentElement {
  type: 'section' | 'subtitle' | 'description' | 'crossref' | 'paragraph';
  class?: string;
  index: number;
  content: string;
  fullMatch: string;
  order?: number;
}

interface NonVerseElement {
  index: number;
  html: string;
  order: number;
}

interface AllContentElement {
  order: number;
  html: string;
}

/**
 * Bible 본문 콘텐츠 로딩 및 파싱 composable
 */
export function useBibleContent(): UseBibleContentReturn {
  // ============================================
  // Dependencies
  // ============================================

  const { fetchKntContent, fetchStandardContent, getFallbackUrl } = useBibleFetch();
  const { bookNames } = useBibleData();
  const readingSettingsStore = useReadingSettingsStore();

  // ============================================
  // State
  // ============================================

  const content = ref('');
  const chapterTitle = ref('');
  const isLoading = ref(true);  // 초기값 true: 페이지 로드 시 스켈레톤 표시
  const error = ref<Error | null>(null);

  // ============================================
  // Internal Helper Functions
  // ============================================

  /**
   * 각주 처리 함수: 각주를 마커로 변환하거나 제거
   */
  const processFootnotes = (text: string): string => {
    const showFootnotes = readingSettingsStore.settings.showFootnotes;
    
    if (showFootnotes) {
      // 각주를 마커로 변환
      return text.replace(
        /<span[^>]*class="f"[^>]*>[\s\S]*?<span class="ft">([^<]*)<\/span>\s*<\/span>/gs,
        (match, footnoteText) => {
          if (footnoteText && footnoteText.trim()) {
            const escapedText = footnoteText.trim()
              .replace(/"/g, '&quot;')
              .replace(/'/g, '&#39;');
            return `<sup class="footnote-marker" data-footnote="${escapedText}" title="${escapedText}">*</sup>`;
          }
          return '';
        }
      ).replace(
        /<span[^>]*data-caller[^>]*>[\s\S]*?<\/span>\s*<\/span>\s*<\/span>/g,
        ''
      ).replace(
        /<span[^>]*data-caller[^>]*>[\s\S]*?<\/span>/gs,
        ''
      );
    } else {
      // 각주 완전 제거
      return text
        .replace(/<span[^>]*class="f"[^>]*>.*?<\/span>.*?<\/span>.*?<\/span>/gs, '')
        .replace(/<span[^>]*data-caller[^>]*>.*?<\/span>.*?<\/span>.*?<\/span>/gs, '')
        .replace(/<span[^>]*data-caller[^>]*>.*?<\/span>/gs, '');
    }
  };

  /**
   * HTML 엔티티 디코딩 및 태그 정리
   */
  const cleanHtmlContent = (text: string, preserveFootnoteMarkers = false): string => {
    let result = text
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'");
    
    if (preserveFootnoteMarkers) {
      // footnote-marker는 보존하고 나머지 HTML 태그 제거
      result = result.replace(/<(?!\/?sup[^>]*class="footnote-marker")[^>]+>/g, '');
    } else {
      result = result.replace(/<\/?[^>]+(>|$)/g, '');
    }
    
    return result.trim();
  };

  // ============================================
  // KNT Parsing Functions
  // ============================================

  /**
   * KNT(새한글성경) 본문 파싱 - reading.vue의 parseKntVersion 로직 포팅
   */
  const parseKntContent = (jsonData: any, book: string, chapter: number): string => {
    const suffix = book === 'psa' ? '편' : '장';
    const bookName = bookNames[book] || '';

    // 장 제목 설정
    if (jsonData.reference) {
      if (/\d+(장|편)/.test(jsonData.reference)) {
        chapterTitle.value = jsonData.reference;
      } else {
        chapterTitle.value = `${jsonData.reference}${suffix}`;
      }
    } else {
      chapterTitle.value = `${bookName} ${chapter}${suffix}`;
    }

    if (!jsonData.content) {
      return '<p class="no-content">내용을 찾을 수 없습니다.</p>';
    }

    const verses: string[] = [];
    const contentHtml = jsonData.content;

    // 읽기 설정 옵션
    const showDescription = readingSettingsStore.settings.showDescription;
    const showCrossRef = readingSettingsStore.settings.showCrossRef;

    // 1. 모든 HTML 태그별로 분석

    // 섹션 제목들 찾기
    const sectionTitles: ContentElement[] = [];
    const sectionRegex = /<p class="s">(.*?)<\/p>/g;
    let sectionMatch;
    while ((sectionMatch = sectionRegex.exec(contentHtml)) !== null) {
      sectionTitles.push({
        type: 'section',
        index: sectionMatch.index,
        content: sectionMatch[1].trim(),
        fullMatch: sectionMatch[0],
      });
    }

    // 부제목 찾기
    const subTitles: ContentElement[] = [];
    const subTitleRegex = /<p class="sp">(.*?)<\/p>/g;
    let subTitleMatch;
    while ((subTitleMatch = subTitleRegex.exec(contentHtml)) !== null) {
      subTitles.push({
        type: 'subtitle',
        index: subTitleMatch.index,
        content: subTitleMatch[1].trim(),
        fullMatch: subTitleMatch[0],
      });
    }

    // 설명/주석 찾기 (d 클래스: 시편 머리말, 음악 지시어 등)
    const descriptions: ContentElement[] = [];
    const descRegex = /<p class="d">(.*?)<\/p>/gs;
    let descMatch;
    while ((descMatch = descRegex.exec(contentHtml)) !== null) {
      const cleanText = descMatch[1]
        .replace(/<span[^>]*class="f"[^>]*>.*?<\/span>.*?<\/span>.*?<\/span>/gs, '')
        .replace(/<span[^>]*data-caller[^>]*>.*?<\/span>.*?<\/span>.*?<\/span>/gs, '')
        .replace(/<span[^>]*class="verse-span"[^>]*>.*?<\/span>/gs, '')
        .replace(/<span[^>]*class="v"[^>]*>\d+<\/span>/gs, '')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim();

      if (cleanText) {
        descriptions.push({
          type: 'description',
          index: descMatch.index,
          content: cleanText,
          fullMatch: descMatch[0],
        });
      }
    }

    // 교차 참조 찾기 (r 클래스)
    const crossRefs: ContentElement[] = [];
    const crossRefRegex = /<p class="r">(.*?)<\/p>/gs;
    let crossRefMatch;
    while ((crossRefMatch = crossRefRegex.exec(contentHtml)) !== null) {
      const cleanText = crossRefMatch[1]
        .replace(/<span[^>]*id="[^"]*"[^>]*>([^<]*)<\/span>/g, '$1')
        .replace(/<\/?[^>]+(>|$)/g, '')
        .trim();

      if (cleanText) {
        crossRefs.push({
          type: 'crossref',
          index: crossRefMatch.index,
          content: cleanText,
          fullMatch: crossRefMatch[0],
        });
      }
    }

    // 모든 타입의 구절 단락 찾기 (p.p, p.q1, p.nb 등)
    const paragraphs: ContentElement[] = [];
    const paragraphRegex =
      /<p(?:\s+[^>]*class="([^"]*)"[^>]*|\s+[^>]*data-vid="[^"]*"[^>]*|\s+[^>]*)>(.*?)<\/p>/gs;
    let paragraphMatch;
    while ((paragraphMatch = paragraphRegex.exec(contentHtml)) !== null) {
      const classType = paragraphMatch[1] || 'p';
      paragraphs.push({
        type: 'paragraph',
        class: classType,
        index: paragraphMatch.index,
        content: paragraphMatch[2],
        fullMatch: paragraphMatch[0],
      });
    }

    // 모든 요소를 원래 순서대로 정렬
    const allElements: ContentElement[] = [
      ...sectionTitles,
      ...subTitles,
      ...descriptions,
      ...crossRefs,
      ...paragraphs,
    ].sort((a, b) => a.index - b.index);

    // 2. 요소들 순서대로 처리하여 HTML 생성
    const processedSubtitles = new Set<string>();
    const verseMap = new Map<string, VerseData>();
    const verseOrder: string[] = [];
    const nonVerseElements: NonVerseElement[] = [];

    allElements.forEach((element, elementIndex) => {
      if (element.type === 'section') {
        nonVerseElements.push({
          index: element.index,
          html: `<h3 class="section-title">${element.content}</h3>`,
          order: elementIndex,
        });
      } else if (element.type === 'subtitle') {
        if (!processedSubtitles.has(element.content)) {
          nonVerseElements.push({
            index: element.index,
            html: `<p class="sub-title">${element.content}</p>`,
            order: elementIndex,
          });
          processedSubtitles.add(element.content);
        }
      } else if (element.type === 'description') {
        if (showDescription) {
          nonVerseElements.push({
            index: element.index,
            html: `<p class="description">${element.content}</p>`,
            order: elementIndex,
          });
        }
      } else if (element.type === 'crossref') {
        if (showCrossRef) {
          nonVerseElements.push({
            index: element.index,
            html: `<p class="cross-ref">${element.content}</p>`,
            order: elementIndex,
          });
        }
      } else if (element.type === 'paragraph') {
        // data-vid로 구절 번호 확인하되, 내부에 다른 구절 번호가 있는지도 확인
        const vidMatch = element.fullMatch.match(/data-vid="[^:]+:(\d+)"/);
        const hasOtherVerseNumbers = /<span[^>]*class="v"[^>]*>\d+<\/span>/.test(element.content);

        // data-vid가 있고 내부에 다른 구절 번호가 없는 경우에만 data-vid 기반 처리
        if (vidMatch && !hasOtherVerseNumbers) {
          const verseNum = vidMatch[1];
          let processedContent = processFootnotes(element.content);
          const plainText = cleanHtmlContent(processedContent, true);

          if (plainText) {
            const poeticClass = element.class || 'p';
            if (verseMap.has(verseNum)) {
              const existing = verseMap.get(verseNum)!;
              existing.lines.push({ text: plainText, class: poeticClass });
            } else {
              verseMap.set(verseNum, {
                lines: [{ text: plainText, class: poeticClass }],
                order: elementIndex,
              });
              verseOrder.push(verseNum);
            }
            return;
          }
        }

        // 일반 구절 처리 (verse-span 포함) - data-vid가 없거나 내부에 다른 구절 번호가 있는 경우
        const verseSpans = element.content.match(/<span class="verse-span"[^>]*>.*?<\/span>/gs) || [];
        
        let currentVerseNum: string | null = null;
        let verseText = '';

        if (verseSpans.length > 0) {
          verseSpans.forEach((verseSpan) => {
            const numMatch = verseSpan.match(/<span[^>]*class="v"[^>]*>(\d+)<\/span>/);

            if (numMatch) {
              // 이전 구절 데이터 저장
              if (currentVerseNum && verseText) {
                const poeticClass = element.class || 'p';
                if (verseMap.has(currentVerseNum)) {
                  verseMap.get(currentVerseNum)!.lines.push({ text: verseText, class: poeticClass });
                } else {
                  verseMap.set(currentVerseNum, {
                    lines: [{ text: verseText, class: poeticClass }],
                    order: elementIndex,
                  });
                  verseOrder.push(currentVerseNum);
                }
              }

              currentVerseNum = numMatch[1];
              let processedSpan = verseSpan
                .replace(/<span[^>]*class="v"[^>]*>\d+<\/span>/, '')
                .replace(/<span[^>]*class="verse-span"[^>]*>/, '')
                .replace(/<\/span>$/, '');

              processedSpan = processFootnotes(processedSpan);
              verseText = cleanHtmlContent(processedSpan, true);
            } else {
              // 구절 번호 없는 경우 - 이전 구절에 추가
              let additionalSpan = verseSpan
                .replace(/<span[^>]*class="verse-span"[^>]*>/, '')
                .replace(/<\/span>$/, '');

              additionalSpan = processFootnotes(additionalSpan);
              const additionalText = cleanHtmlContent(additionalSpan, true);

              if (additionalText) {
                if (currentVerseNum) {
                  verseText += ' ' + additionalText;
                } else {
                  const verseIdMatch = verseSpan.match(/data-verse-id="[^.]+\.\d+\.(\d+)"/);
                  if (verseIdMatch) {
                    currentVerseNum = verseIdMatch[1];
                    verseText = additionalText;
                  }
                }
              }
            }
          });

          // 마지막 구절 처리
          if (currentVerseNum && verseText) {
            const poeticClass = element.class || 'p';
            if (verseMap.has(currentVerseNum)) {
              verseMap.get(currentVerseNum)!.lines.push({ text: verseText, class: poeticClass });
            } else {
              verseMap.set(currentVerseNum, {
                lines: [{ text: verseText, class: poeticClass }],
                order: elementIndex,
              });
              verseOrder.push(currentVerseNum);
            }
          }
        } else {
          // verseSpans이 없을 경우 - 직접 구절 찾기
          const directVerseMatch = element.content.match(/^(?:<[^>]*>)*\s*(\d+)\s+(.+)$/);

          if (directVerseMatch) {
            const verseNum = directVerseMatch[1];
            let verseContent = processFootnotes(directVerseMatch[2]);
            verseContent = cleanHtmlContent(verseContent, true);

            const poeticClass = element.class || 'p';
            if (verseMap.has(verseNum)) {
              verseMap.get(verseNum)!.lines.push({ text: verseContent, class: poeticClass });
            } else {
              verseMap.set(verseNum, {
                lines: [{ text: verseContent, class: poeticClass }],
                order: elementIndex,
              });
              verseOrder.push(verseNum);
            }
          } else {
            // 구절 번호 패턴이 없는 경우 - 시적 구조 처리
            const plainText = cleanHtmlContent(element.content);
            const poeticClasses = ['q1', 'q2', 'q3', 'q4', 'm', 'pi1', 'pi2', 'nb', 'pc', 'pm', 'pmo', 'pmc'];
            if (plainText && poeticClasses.includes(element.class || '')) {
              nonVerseElements.push({
                index: element.index,
                html: `<div class="paragraph ${element.class}">${plainText}</div>`,
                order: elementIndex,
              });
            }
          }
        }
      }
    });

    // 3. 모든 요소를 원본 순서대로 정렬하여 verses 배열 구성
    const allContentElements: AllContentElement[] = [];

    // 구절들을 원본 인덱스와 함께 저장
    verseOrder.forEach((verseNum) => {
      const verseData = verseMap.get(verseNum);
      if (verseData && verseData.lines) {
        const linesHtml = verseData.lines.map((line, idx) => {
          if (idx === 0) {
            return `<div class="verse-line ${line.class}"><span class="verse-number">${verseNum}</span><span class="verse-text">${line.text}</span></div>`;
          } else {
            return `<div class="verse-line continuation ${line.class}"><span class="verse-text">${line.text}</span></div>`;
          }
        }).join('');

        allContentElements.push({
          order: verseData.order,
          html: `<div class="verse verse-group">${linesHtml}</div>`,
        });
      }
    });

    // 구절이 아닌 요소들 추가
    allContentElements.push(...nonVerseElements);

    // order 기준으로 정렬
    allContentElements.sort((a, b) => a.order - b.order);

    // HTML 배열 생성
    allContentElements.forEach((element) => {
      verses.push(element.html);
    });

    return verses.length > 0
      ? verses.join('')
      : '<p class="no-content">내용을 찾을 수 없습니다.</p>';
  };

  /**
   * font 태그 전처리 (브라우저의 잘못된 HTML 수정 방지)
   */
  const preprocessFontTags = (html: string): string => {
    let processed = html;

    // 1단계: font class="name/area/orgin" 태그를 span으로 변환
    let prevLength = 0;
    let iterations = 0;
    while (processed.length !== prevLength && iterations < 10) {
      prevLength = processed.length;
      iterations++;
      processed = processed
        .replace(/<font\s+class="name">([^<]*)<\/font>/gi, '<span class="bible-name">$1</span>')
        .replace(/<font\s+class="area">([^<]*)<\/font>/gi, '<span class="bible-area">$1</span>')
        .replace(/<font\s+class="orgin">([^<]*)<\/font>/gi, '$1');
    }

    // 2단계: smallTitle을 section-title로 변환
    processed = processed.replace(/<font\s+class="smallTitle">([\s\S]*?)<\/font>/gi, '<h4 class="section-title">$1</h4>');

    // 3단계: chapNum 제거
    processed = processed.replace(/<font\s+class="chapNum">[^<]*<\/font>/gi, '');

    // 4단계: 나머지 font 태그 내용만 유지
    iterations = 0;
    prevLength = 0;
    while (processed.length !== prevLength && iterations < 10) {
      prevLength = processed.length;
      iterations++;
      processed = processed.replace(/<font[^>]*>([^<]*)<\/font>/gi, '$1');
    }

    // 5단계: 고아 </font> 태그 제거
    processed = processed.replace(/<\/font>/gi, '');

    return processed;
  };

  /**
   * DOM 정리 함수
   */
  const cleanupBibleElement = (bibleElement: Element): void => {
    // section-title 내부의 a 태그는 href만 제거
    const sectionTitles = bibleElement.querySelectorAll('h4.section-title');
    sectionTitles.forEach((section) => {
      const anchors = section.querySelectorAll('a');
      anchors.forEach((anchor) => {
        anchor.removeAttribute('href');
      });
    });

    // 그 외의 a 태그는 완전히 제거
    const otherAnchors = bibleElement.querySelectorAll('a:not(h4.section-title a)');
    otherAnchors.forEach((anchor) => {
      anchor.remove();
    });

    // 기타 불필요한 요소 제거
    const elementsToRemove = bibleElement.querySelectorAll(
      'input, select, form, .fontcontrol, [style*="display:none"], [style*="display: none"]'
    );
    elementsToRemove.forEach((el) => el.remove());
  };

  /**
   * 구절 텍스트에서 태그 정리
   */
  const cleanVerseText = (html: string): string => {
    let text = html;
    // font 태그를 span으로 변환
    text = text
      .replace(/<font\s+class="name">([^<]*)<\/font>/gi, '<span class="bible-name">$1</span>')
      .replace(/<font\s+class="area">([^<]*)<\/font>/gi, '<span class="bible-area">$1</span>')
      .replace(/<font\s+class="orgin">([^<]*)<\/font>/gi, '$1')
      .replace(/<font[^>]*>([^<]*)<\/font>/gi, '$1')
      .replace(/<\/font>/gi, '');

    // bible-name, bible-area 클래스 보존하고 나머지 태그 제거
    const placeholders: string[] = [];
    text = text.replace(/<span\s+class="bible-(name|area)">[^<]*<\/span>/gi, (match) => {
      placeholders.push(match);
      return `__BIBLE_PLACEHOLDER_${placeholders.length - 1}__`;
    });
    text = text.replace(/<[^>]+>/g, '');
    text = text.replace(/__BIBLE_PLACEHOLDER_(\d+)__/g, (_, idx) => placeholders[parseInt(idx)] || '');

    return text.trim();
  };

  /**
   * 표준 역본 파싱
   */
  const parseStandardContent = (htmlText: string, book: string, chapter: number): string => {
    // font 태그 전처리
    const preprocessedHtml = preprocessFontTags(htmlText);
    const parser = new DOMParser();
    const doc = parser.parseFromString(preprocessedHtml, 'text/html');
    const bibleElement = doc.getElementById('tdBible1');

    if (!bibleElement) {
      return generateErrorContent(book, chapter);
    }

    // DOM 정리
    cleanupBibleElement(bibleElement);

    // 장 제목 설정
    const chapNum = bibleElement.querySelector('.chapNum');
    const suffix = book === 'psa' ? '편' : '장';
    if (chapNum) {
      const chapterNumber = chapNum.textContent
        ?.replace('제', '')
        .replace('장', '')
        .replace('편', '')
        .trim();
      chapterTitle.value = `${bookNames[book]} ${chapterNumber}${suffix}`;
    } else {
      chapterTitle.value = `${bookNames[book]} ${chapter}${suffix}`;
    }

    // 본문 추출 (TreeWalker 사용)
    const verses: string[] = [];
    const processedVerses = new Set<string>();

    const walker = document.createTreeWalker(
      bibleElement,
      NodeFilter.SHOW_ELEMENT,
      {
        acceptNode: (node: Node) => {
          const el = node as Element;
          if (el.tagName === 'H4' && el.classList?.contains('section-title')) {
            return NodeFilter.FILTER_ACCEPT;
          }
          if (el.classList?.contains('number')) {
            return NodeFilter.FILTER_ACCEPT;
          }
          return NodeFilter.FILTER_SKIP;
        }
      }
    );

    let currentNode: Node | null;
    while ((currentNode = walker.nextNode())) {
      const el = currentNode as Element;

      if (el.tagName === 'H4' && el.classList?.contains('section-title')) {
        // 섹션 타이틀 처리
        let titleText = el.textContent?.trim()
          .replace(/\(\s*\)/g, '')
          .replace(/\s+/g, ' ')
          .trim() || '';

        titleText = titleText.replace(
          /(\([^)]+\))/g,
          '<span class="reference">$1</span>'
        );

        if (titleText) {
          verses.push(`<h3 class="section-title">${titleText}</h3>`);
        }
      } else if (el.classList?.contains('number')) {
        // 절 번호 처리
        const number = el.textContent?.trim().replace(/\s+/g, '') || '';

        if (processedVerses.has(number)) continue;
        processedVerses.add(number);

        // 부모 span에서 본문 추출
        const parentSpan = el.parentElement;
        if (parentSpan && parentSpan.tagName === 'SPAN') {
          let rawHtml = parentSpan.innerHTML;
          rawHtml = rawHtml.replace(/<span[^>]*class="number"[^>]*>.*?<\/span>/gi, '');
          const text = cleanVerseText(rawHtml);

          verses.push(
            `<div class="verse"><span class="verse-number">${number}</span><span class="verse-text">${text}</span></div>`
          );
        }
      }
    }

    // 내용이 없으면 백업 방법 시도
    if (verses.length === 0) {
      const textNodes = Array.from(bibleElement.querySelectorAll('span')).filter(
        (span) => span.querySelector('.number')
      );

      textNodes.forEach((node) => {
        const numberSpan = node.querySelector('.number');
        if (numberSpan) {
          const number = numberSpan.textContent?.trim().replace(/\s+/g, '') || '';
          let rawHtml = node.innerHTML;
          rawHtml = rawHtml.replace(/<span[^>]*class="number"[^>]*>.*?<\/span>/gi, '');
          const text = cleanVerseText(rawHtml);

          verses.push(
            `<div class="verse"><span class="verse-number">${number}</span><span class="verse-text">${text}</span></div>`
          );
        }
      });
    }

    return verses.length > 0
      ? verses.join('')
      : '<p class="no-content">내용을 찾을 수 없습니다.</p>';
  };

  const generateErrorContent = (book: string, chapter: number, version: string = 'GAE'): string => {
    const fallbackUrl = getFallbackUrl(version, book, chapter);
    return `
      <div class="error-message">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none">
          <path d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <h3>성경을 불러오는데 문제가 발생했습니다</h3>
        <p>잠시 후 다시 시도하거나, 대한성서공회 사이트에서 직접 확인해주세요.</p>
        <a href="${fallbackUrl}" target="_blank" class="external-link">
          대한성서공회에서 보기
        </a>
      </div>
    `;
  };

  // ============================================
  // Public Actions
  // ============================================

  /**
   * 성경 본문 로드
   */
  const loadContent = async (book: string, chapter: number, version: string): Promise<void> => {
    isLoading.value = true;
    error.value = null;

    try {
      if (version === 'KNT') {
        const result = await fetchKntContent(book, chapter);

        if (result.source === 'error') {
          content.value = generateErrorContent(book, chapter, version);
          return;
        }

        try {
          const jsonData = JSON.parse(result.content);
          if (jsonData.found) {
            content.value = parseKntContent(jsonData, book, chapter);
          } else {
            content.value = generateErrorContent(book, chapter, version);
          }
        } catch {
          content.value = generateErrorContent(book, chapter, version);
        }
      } else {
        const result = await fetchStandardContent(version, book, chapter);

        if (result.source === 'error') {
          content.value = generateErrorContent(book, chapter, version);
          return;
        }

        content.value = parseStandardContent(result.content, book, chapter);
      }
    } catch (e) {
      console.error('성경 본문 로드 실패:', e);
      error.value = e as Error;
      content.value = generateErrorContent(book, chapter, version);
    } finally {
      isLoading.value = false;
    }
  };

  /**
   * 콘텐츠 초기화
   */
  const clearContent = (): void => {
    content.value = '';
    chapterTitle.value = '';
    error.value = null;
  };

  // ============================================
  // Return
  // ============================================

  return {
    // State
    content,
    chapterTitle,
    isLoading,
    error,

    // Actions
    loadContent,
    clearContent,
  };
}
