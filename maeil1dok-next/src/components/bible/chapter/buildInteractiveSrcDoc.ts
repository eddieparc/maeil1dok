export function buildInteractiveSrcDoc(content: string) {
  const interactionScript = `
<style>
  :root {
    --bible-bg: #f9fafb;
    --bible-text: #1f2937;
    --bible-border: #e5e7eb;
    --bible-muted: #999999;
    --bible-selection-bg: rgba(75, 159, 126, 0.18);
    --bible-selection-outline: #4b9f7e;
    --bible-header: var(--color-accent-primary, #4b9f7e);
    --bible-highlight-alpha: 0.46;
    --section-title-color: #4a5d4a;
  }

  body {
    margin: 0;
    padding: 1rem;
    background: var(--bible-bg);
    color: var(--bible-text);
    font-family: var(--font-family-reading, "KoPub Batang"), "Noto Serif KR", serif;
    font-size: 1rem;
    line-height: 1.8;
    letter-spacing: -0.02em;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    transition: background-color 0.2s ease, color 0.2s ease;
    word-break: keep-all;
  }

  @media (max-width: 768px) {
    body {
      padding-left: 5px;
      padding-right: 5px;
    }
  }

  /* === 절 노드 (ocd-verse-node = 파서 출력 .verse) === */
  .ocd-verse-node {
    display: flex;
    align-items: flex-start;
    letter-spacing: -0.02em;
    transition: background-color 0.3s ease-in-out;
    padding: 0.25rem 0.35rem;
    border-radius: 8px;
    cursor: pointer;
  }

  .ocd-verse-node:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  /* === 절 번호 === */
  .ocd-verse-number {
    color: var(--bible-muted);
    font-weight: 500;
    margin-right: 0.3rem;
    min-width: 0.8em;
    flex-shrink: 0;
    text-align: right;
    font-size: 0.75em;
    font-family: "Pretendard", var(--font-noto-sans-kr, "Noto Sans KR"), sans-serif;
    position: relative;
    line-height: 2;
  }

  /* === 절 텍스트 === */
  .ocd-verse-text {
    flex: 1;
    border-radius: 6px;
    padding: 0.02rem 0.15rem;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
    color: var(--bible-text);
  }

  .ocd-verse-node.ocd-highlight .ocd-verse-text {
    background: var(--verse-highlight-color, rgba(250, 204, 21, 0.36));
  }

  .ocd-verse-node.ocd-selected {
    background: var(--bible-selection-bg);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bible-selection-outline) 42%, transparent);
  }

  .ocd-verse-node.ocd-highlight.ocd-selected {
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bible-selection-outline) 70%, transparent);
  }

  /* === verse-group (KNT 시적 구조 — 여러 verse-line 묶음) === */
  .ocd-verse-group {
    display: block;
    padding: 0;
    margin: 0.25rem 0;
    border-radius: 8px;
    cursor: pointer;
    transition: background-color 0.3s ease-in-out;
  }

  .ocd-verse-group:hover {
    background: rgba(0, 0, 0, 0.04);
  }

  .ocd-verse-group.ocd-selected {
    background: var(--bible-selection-bg);
    box-shadow: inset 0 0 0 1px color-mix(in srgb, var(--bible-selection-outline) 42%, transparent);
  }

  /* === verse-line (KNT 내부 줄) === */
  .ocd-verse-line {
    display: flex;
    align-items: flex-start;
    line-height: inherit;
    letter-spacing: -0.02em;
    padding: 0.25rem 0.35rem;
  }

  .ocd-verse-line.continuation {
    padding-left: 1.3em;
  }

  /* 시적 구조 들여쓰기 */
  .ocd-verse-line.q1 { padding-left: 1.5em; }
  .ocd-verse-line.continuation.q1 { padding-left: calc(1.3em + 1.5em); }
  .ocd-verse-line.q2 { padding-left: 2.5em; }
  .ocd-verse-line.continuation.q2 { padding-left: calc(1.3em + 2.5em); }
  .ocd-verse-line.q3 { padding-left: 3.5em; }
  .ocd-verse-line.continuation.q3 { padding-left: calc(1.3em + 3.5em); }
  .ocd-verse-line.q4 { padding-left: 4.5em; }
  .ocd-verse-line.continuation.q4 { padding-left: calc(1.3em + 4.5em); }
  .ocd-verse-line.m { padding-left: 0.5em; }
  .ocd-verse-line.continuation.m { padding-left: calc(1.3em + 0.5em); }

  /* === 섹션 타이틀 === */
  .ocd-section-title,
  .section-title,
  h3,
  h4 {
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    font-size: 1.1rem;
    font-weight: 600;
    color: var(--section-title-color);
    margin: 2rem 0 0.25rem;
    text-align: center;
    line-height: 1.45;
  }

  .ocd-section-title:first-child,
  .section-title:first-child,
  h3:first-child,
  h4:first-child {
    margin-top: 0;
  }

  /* === 부제목 === */
  .sub-title {
    font-size: 0.875rem;
    color: var(--section-title-color);
    font-style: italic;
    margin: 1rem 0 0.5rem;
    text-align: center;
  }

  /* === 설명/주석 === */
  .description {
    font-style: italic;
    font-size: 0.9em;
    color: #6b7280;
    margin: 0.5rem 0 1rem;
    padding-left: 0.75rem;
    border-left: 2px solid var(--bible-border);
    line-height: 1.6;
  }

  /* === 교차 참조 === */
  .cross-ref {
    font-size: 0.85em;
    color: #6b7280;
    margin: 0.25rem 0 0.75rem;
    padding-left: 0.5rem;
  }

   /* === 인명/지명 === */
   .bible-name {
     color: #7c5a3c;
     text-decoration-line: underline;
     text-decoration-style: dotted;
     text-decoration-color: currentColor;
     text-decoration-thickness: 1px;
     text-underline-offset: 2px;
   }

   .bible-area {
     color: #5a6e54;
     text-decoration-line: underline;
     text-decoration-style: dotted;
     text-decoration-color: currentColor;
     text-decoration-thickness: 1px;
     text-underline-offset: 2px;
   }

   /* 인명/지명 강조 비활성화 */
   body.ocd-hide-names .bible-name,
   body.ocd-hide-names .bible-area {
     color: inherit;
   }

  /* === 각주 마커 === */
   .footnote-marker {
     color: #6366f1;
     cursor: help;
     font-size: 0.75em;
     vertical-align: super;
     margin: 0 1px;
     font-weight: 500;
     position: relative;
   }

  /* === 섹션 제목 내 참조 === */
  .reference {
    font-size: 0.75em;
    font-weight: 500;
    color: #6b7280;
    margin-left: 0.25rem;
  }

  /* === 시적 구조 (verse/paragraph 공용) === */
  .paragraph { margin: 0.5rem 0; line-height: 1.8; }
  .paragraph.q1 { padding-left: 40px; }
  .paragraph.q2 { padding-left: 60px; }
  .paragraph.q3 { padding-left: 80px; }
  .paragraph.q4 { padding-left: 100px; }
  .paragraph.m { padding-left: 1.5rem; margin-top: 0; }
  .paragraph.pc { text-align: center; }

  /* === 절 붙임 모드 === */
  body.ocd-verse-joining .ocd-verse-node {
    display: inline;
    padding: 0;
  }

  body.ocd-verse-joining .ocd-verse-node .ocd-verse-number {
    display: inline;
    font-size: 0.65em;
    vertical-align: super;
    margin: 0 0.1em;
    min-width: auto;
    text-align: left;
    line-height: 1;
  }

  body.ocd-verse-joining .ocd-verse-node .ocd-verse-text {
    display: inline;
  }

  body.ocd-verse-joining .ocd-verse-node .ocd-verse-text::after {
    content: " ";
  }

  body.ocd-verse-joining .ocd-verse-group {
    display: inline;
  }

  body.ocd-verse-joining .ocd-verse-line {
    display: inline;
    padding: 0;
  }

  body.ocd-verse-joining .ocd-verse-line.continuation {
    padding-left: 0;
  }

  body.ocd-verse-joining .ocd-section-title,
  body.ocd-verse-joining .section-title,
  body.ocd-verse-joining h3,
  body.ocd-verse-joining h4 {
    display: block;
    margin-top: 1.5em;
    margin-bottom: 0.5em;
  }

  body.ocd-verse-joining .ocd-verse-node.ocd-highlight .ocd-verse-text,
  body.ocd-verse-joining .ocd-verse-node.ocd-selected .ocd-verse-text {
    border-radius: 4px;
  }

  /* === 다크 모드 === */
  body.ocd-theme-dark {
    --bible-bg: #1a1a1a;
    --bible-text: #e5e5e5;
    --bible-border: #30363f;
    --bible-muted: #666666;
    --bible-selection-bg: rgba(107, 201, 159, 0.2);
    --bible-selection-outline: #6bc99f;
    --bible-header: #b8d4c4;
    --bible-highlight-alpha: 0.3;
    --section-title-color: #8ba888;
  }

  body.ocd-theme-dark .ocd-verse-node:hover,
  body.ocd-theme-dark .ocd-verse-group:hover {
    background: rgba(255, 255, 255, 0.06);
  }

  body.ocd-theme-dark .description {
    color: #9ca3af;
    border-left-color: #404040;
  }

  body.ocd-theme-dark .cross-ref {
    color: #9ca3af;
  }

  body.ocd-theme-dark .sub-title {
    color: var(--section-title-color);
  }

  body.ocd-theme-dark .bible-name {
    color: #c9a67a;
  }

  body.ocd-theme-dark .bible-area {
    color: #9cb094;
  }

   body.ocd-theme-dark .footnote-marker {
     color: #60a5fa;
   }

   body.ocd-theme-dark .reference {
     color: #9ca3af;
   }

   body.ocd-theme-dark.ocd-hide-names .bible-name,
   body.ocd-theme-dark.ocd-hide-names .bible-area {
     color: inherit;
   }

   .footnote-marker:hover::after,
   .footnote-marker:focus::after {
     content: attr(data-footnote);
     position: absolute;
     left: 50%;
     bottom: 100%;
     transform: translateX(-50%);
     background: #1f2937;
     color: white;
     padding: 0.5rem 0.75rem;
     border-radius: 0.375rem;
     font-size: 0.8125rem;
     font-weight: normal;
     max-width: 280px;
     width: max-content;
     z-index: 100;
     white-space: normal;
     line-height: 1.5;
     box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);
     margin-bottom: 4px;
   }

   body.ocd-theme-dark .footnote-marker:hover::after,
   body.ocd-theme-dark .footnote-marker:focus::after {
     background: #374151;
     color: #f3f4f6;
   }
</style>
<script>
  (function () {
    var COLOR_MAP = {
      yellow: 'rgba(250, 204, 21, var(--bible-highlight-alpha))',
      green: 'rgba(74, 222, 128, var(--bible-highlight-alpha))',
      blue: 'rgba(96, 165, 250, var(--bible-highlight-alpha))',
      pink: 'rgba(244, 114, 182, var(--bible-highlight-alpha))',
      purple: 'rgba(192, 132, 252, var(--bible-highlight-alpha))'
    };

    var currentHighlights = [];
    var currentSelection = null;
    var suppressClickUntil = 0;

    function cleanText(value) {
      return (value || '').replace(/\s+/g, ' ').trim();
    }

    function normalizeParserOutput(settings) {
      var showNums = settings.showVerseNumbers !== false;

      document.querySelectorAll('.verse').forEach(function (el) {
        if (el.classList.contains('ocd-verse-node') || el.classList.contains('ocd-verse-group')) return;

        if (el.classList.contains('verse-group')) {
          el.classList.add('ocd-verse-group');
          var numEl = el.querySelector('.verse-number');
          var verseNum = numEl ? numEl.textContent.trim() : '';
          if (verseNum) el.setAttribute('data-verse-number', verseNum);

          el.querySelectorAll('.verse-line').forEach(function (line) {
            line.classList.add('ocd-verse-line');
            var lineNumEl = line.querySelector('.verse-number');
            if (lineNumEl) {
              lineNumEl.classList.add('ocd-verse-number');
              lineNumEl.style.display = showNums ? '' : 'none';
            }
            var lineTextEl = line.querySelector('.verse-text');
            if (lineTextEl) lineTextEl.classList.add('ocd-verse-text');
          });
          return;
        }

        el.classList.add('ocd-verse-node');
        var numEl = el.querySelector('.verse-number');
        var textEl = el.querySelector('.verse-text');

        if (numEl && textEl) {
          var verseNum = numEl.textContent.trim();
          el.setAttribute('data-verse-number', verseNum);
          numEl.classList.add('ocd-verse-number');
          numEl.style.display = showNums ? '' : 'none';
          textEl.classList.add('ocd-verse-text');
        }
      });
    }

    function normalizeSectionHeaders() {
      document.querySelectorAll('.section-title, h3, h4').forEach(function (node) {
        node.classList.add('ocd-section-title');
      });
    }

    var FONT_WEIGHT_MAP = { normal: '400', medium: '500', bold: '600' };

    function applyContentVisibility(settings) {
      var hideDesc = settings.showDescription === false;
      var hideCrossRef = settings.showCrossRef === false;
      var hideFootnotes = settings.showFootnotes === false;
      var hideNames = settings.highlightNames === false;

      document.querySelectorAll('.description').forEach(function (el) {
        el.style.display = hideDesc ? 'none' : '';
      });

      document.querySelectorAll('.cross-ref').forEach(function (el) {
        el.style.display = hideCrossRef ? 'none' : '';
      });

      document.querySelectorAll('.footnote-marker').forEach(function (el) {
        el.style.display = hideFootnotes ? 'none' : '';
      });

      document.body.classList.toggle('ocd-hide-names', hideNames);
    }

    function applyReadingSettings(settings) {
      if (!document.body) return;

      var body = document.body;
      var useDark = settings.theme === 'dark';

      body.classList.toggle('ocd-theme-dark', useDark);
      body.classList.toggle('ocd-verse-joining', Boolean(settings.verseJoining));
      body.style.fontFamily = settings.fontFamily && settings.fontFamily !== 'system'
        ? settings.fontFamily + ', "KoPub Batang", "Noto Serif KR", serif'
        : 'var(--font-family-reading, "KoPub Batang"), "Noto Serif KR", serif';
      body.style.fontSize = settings.fontSize ? String(settings.fontSize) + 'px' : '';
      body.style.lineHeight = settings.lineHeight ? String(settings.lineHeight) : '';
      var fw = settings.fontWeight || '';
      body.style.fontWeight = FONT_WEIGHT_MAP[fw] || fw;
      body.style.textAlign = settings.textAlign === 'justify' ? 'justify' : 'left';

      normalizeParserOutput(settings);
      normalizeSectionHeaders();
      applyContentVisibility(settings);
      applyHighlights(currentHighlights);
      applySelection(currentSelection);
    }

    var VERSE_SELECTOR = '[data-verse-number]';

    function clearHighlights() {
      document.querySelectorAll('.ocd-highlight').forEach(function (node) {
        node.classList.remove('ocd-highlight');
        node.style.removeProperty('--verse-highlight-color');
      });
    }

    function applyHighlights(highlights) {
      currentHighlights = Array.isArray(highlights) ? highlights : [];
      clearHighlights();

      currentHighlights.forEach(function (highlight) {
        var start = Number(highlight && highlight.verseStart);
        var end = Number(highlight && highlight.verseEnd);
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;

        var color = COLOR_MAP[highlight.color] || COLOR_MAP.yellow;
        for (var verse = start; verse <= end; verse += 1) {
          var node = document.querySelector(VERSE_SELECTOR.replace(']', '="' + String(verse) + '"]'));
          if (!node) continue;
          node.classList.add('ocd-highlight');
          node.style.setProperty('--verse-highlight-color', color);
        }
      });
    }

    function applySelection(range) {
      currentSelection = range && typeof range === 'object' ? range : null;

      document.querySelectorAll('.ocd-selected').forEach(function (node) {
        node.classList.remove('ocd-selected');
      });

      if (!currentSelection) return;

      var start = Number(currentSelection.start);
      var end = Number(currentSelection.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return;

      for (var verse = start; verse <= end; verse += 1) {
        var node = document.querySelector('[data-verse-number="' + String(verse) + '"]');
        if (node) node.classList.add('ocd-selected');
      }
    }

    function getSelectionVerses(range) {
      var nodes = Array.from(document.querySelectorAll('[data-verse-number]'));
      var selected = [];

      nodes.forEach(function (node) {
        var verse = Number(node.getAttribute('data-verse-number'));
        if (!Number.isFinite(verse)) {
          return;
        }

        try {
          if (range.intersectsNode(node)) {
            selected.push(verse);
          }
        } catch (_error) {
          return;
        }
      });

      if (selected.length === 0) {
        return null;
      }

      return {
        startVerse: Math.min.apply(null, selected),
        endVerse: Math.max.apply(null, selected),
      };
    }

    function handleTextSelection() {
      var selection = window.getSelection && window.getSelection();
      if (!selection || selection.isCollapsed || selection.rangeCount === 0) {
        return;
      }

      var selectedText = cleanText(selection.toString());
      if (!selectedText) {
        return;
      }

      var range = selection.getRangeAt(0);
      var verses = getSelectionVerses(range);
      if (!verses) {
        return;
      }

      var rect = range.getBoundingClientRect();
      suppressClickUntil = Date.now() + 220;

      window.parent.postMessage(
        {
          type: 'bible-text-selection',
          text: selectedText,
          startVerse: verses.startVerse,
          endVerse: verses.endVerse,
          x: rect.left + rect.width / 2,
          y: rect.top,
        },
        '*'
      );
    }

    document.addEventListener('click', function (event) {
      if (Date.now() < suppressClickUntil) return;

      var target = event.target;
      var verseNode = target && target.closest
        ? (target.closest('.ocd-verse-node') || target.closest('.ocd-verse-group'))
        : null;
      var selectedText = window.getSelection ? window.getSelection().toString() : '';

      var verseNumber = null;
      var text = '';

      if (verseNode) {
        verseNumber = Number(verseNode.getAttribute('data-verse-number'));
        if (!Number.isFinite(verseNumber)) verseNumber = null;
        var textEl = verseNode.querySelector('.ocd-verse-text');
        text = cleanText(selectedText || (textEl ? textEl.textContent : verseNode.textContent) || '');
      } else {
        text = cleanText(selectedText || (document.body && document.body.innerText) || '');
      }

      window.parent.postMessage(
        {
          type: 'bible-verse-tap',
          text: text,
          verseNumber: verseNumber,
          x: event.clientX,
          y: event.clientY
        },
        '*'
      );
    });

    document.addEventListener('mouseup', handleTextSelection);
    document.addEventListener('touchend', function () {
      setTimeout(handleTextSelection, 10);
    });

    window.addEventListener('message', function (event) {
      if (!event || !event.data || typeof event.data !== 'object') {
        return;
      }

      if (event.data.type === 'bible-highlights-sync') {
        applyHighlights(event.data.highlights || []);
        return;
      }

      if (event.data.type === 'bible-reading-settings') {
        applyReadingSettings(event.data.settings || {});
        return;
      }

      if (event.data.type === 'bible-selection-sync') {
        applySelection(event.data.selection || null);
      }
    });

    applyReadingSettings({});
    window.parent.postMessage({ type: 'bible-highlights-ready' }, '*');
  })();
</script>
`

  if (content.includes('</body>')) {
    return content.replace('</body>', `${interactionScript}</body>`)
  }

  return `${content}${interactionScript}`
}
