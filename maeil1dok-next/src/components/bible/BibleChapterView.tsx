'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { VerseRange } from './VerseSelector'
import type { VerseHighlight } from '@/types'
import type { UserReadingSettings } from '@/types/profile'

interface BibleChapterViewProps {
  book: string
  chapter: number
  version: string
  content: string
  isLoading: boolean
  error?: string | null
  onRetry?: () => void
  onVerseTap?: (payload: { text: string; verseNumber?: number; position?: { x: number; y: number } }) => void
  highlights?: VerseHighlight[]
  onHighlightsLoaded?: (highlights: VerseHighlight[]) => void
  readingSettings?: UserReadingSettings | null
  selectedVerseRange?: VerseRange | null
}

function buildInteractiveSrcDoc(content: string) {
  const interactionScript = `
<style>
  :root {
    --bible-bg: #ffffff;
    --bible-text: #1f2937;
    --bible-border: #e5e7eb;
    --bible-muted: #6b7280;
    --bible-selection-bg: rgba(75, 159, 126, 0.18);
    --bible-selection-outline: #4b9f7e;
    --bible-header: #4a5d53;
    --bible-highlight-alpha: 0.46;
  }

  body {
    margin: 0;
    padding: 0.5rem;
    background: var(--bible-bg);
    color: var(--bible-text);
    font-family: "KoPub Batang", "Noto Serif KR", serif;
    font-size: 1rem;
    line-height: 1.9;
    text-rendering: optimizeLegibility;
    -webkit-font-smoothing: antialiased;
    transition: background-color 0.2s ease, color 0.2s ease;
  }

  .ocd-verse-node {
    display: block;
    margin: 0.28rem 0;
    border-radius: 10px;
    padding: 0.12rem 0.28rem;
    transition: background-color 0.18s ease, box-shadow 0.18s ease;
    cursor: pointer;
  }

  .ocd-verse-node:hover {
    background: color-mix(in srgb, var(--bible-text) 6%, transparent);
  }

  .ocd-verse-number {
    color: var(--bible-muted);
    opacity: 0.95;
    font-size: 0.66em;
    vertical-align: super;
    margin-right: 0.34rem;
    font-family: var(--font-noto-sans-kr, "Noto Sans KR"), sans-serif;
    font-weight: 500;
    line-height: 1;
  }

  .ocd-verse-text {
    border-radius: 6px;
    padding: 0.02rem 0.15rem;
    box-decoration-break: clone;
    -webkit-box-decoration-break: clone;
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

  .ocd-section-title,
  .section-title,
  h3,
  h4 {
    margin: 1.5rem 0 0.45rem;
    text-align: center;
    color: var(--bible-header);
    font-size: 1.02rem;
    letter-spacing: -0.01em;
    line-height: 1.45;
  }

  .ocd-section-title:first-child,
  .section-title:first-child,
  h3:first-child,
  h4:first-child {
    margin-top: 0;
  }

  body.ocd-verse-joining .ocd-verse-node {
    display: inline;
    margin: 0;
    padding: 0;
    border-radius: 0;
  }

  body.ocd-verse-joining .ocd-verse-node .ocd-verse-text::after {
    content: " ";
  }

  body.ocd-verse-joining .ocd-verse-node.ocd-highlight .ocd-verse-text,
  body.ocd-verse-joining .ocd-verse-node.ocd-selected .ocd-verse-text {
    border-radius: 4px;
  }

  body.ocd-theme-dark {
    --bible-bg: #111418;
    --bible-text: #eef2f7;
    --bible-border: #30363f;
    --bible-muted: #97a1b0;
    --bible-selection-bg: rgba(107, 201, 159, 0.2);
    --bible-selection-outline: #6bc99f;
    --bible-header: #b8d4c4;
    --bible-highlight-alpha: 0.3;
  }

  body.ocd-theme-dark .ocd-verse-node:hover {
    background: color-mix(in srgb, var(--bible-text) 9%, transparent);
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

    function cleanText(value) {
      return (value || '').replace(/\s+/g, ' ').trim();
    }

    function inferVerseNumber(text, node) {
      if (node && node.getAttribute && node.getAttribute('data-verse-number')) {
        return Number(node.getAttribute('data-verse-number'));
      }

      var match = cleanText(text).match(/^(\d{1,3})\b/);
      return match ? Number(match[1]) : null;
    }

    function getCandidates() {
      if (!document.body) {
        return [];
      }

      return Array.from(document.body.querySelectorAll('p, li, div, td, span'));
    }

    function normalizeSectionHeaders() {
      document.querySelectorAll('.section-title, h3, h4').forEach(function (node) {
        node.classList.add('ocd-section-title');
      });
    }

    function shouldSkipNode(node) {
      if (!node) {
        return true;
      }

      if (node.querySelector('.ocd-verse-text')) {
        return false;
      }

      var className = node.className || '';
      if (/section-title|cross-ref|description|footnote|sub-title/i.test(className)) {
        return true;
      }

      var text = cleanText(node.textContent || '');
      if (!text || text.length < 2) {
        return true;
      }

      return !/^\d{1,3}\b/.test(text);
    }

    function wrapVerseNode(node, settings) {
      if (shouldSkipNode(node)) {
        return;
      }

      if (!node.getAttribute('data-base-html')) {
        node.setAttribute('data-base-html', node.innerHTML || '');
      }

      var baseHtml = node.getAttribute('data-base-html') || '';
      var verseNumber = inferVerseNumber(node.textContent || '', node);
      if (!verseNumber || !baseHtml) {
        return;
      }

      var textHtml = baseHtml.replace(/^\s*\d{1,3}\s+/, '');
      if (!textHtml) {
        textHtml = baseHtml;
      }

      node.classList.add('ocd-verse-node');
      node.setAttribute('data-verse-number', String(verseNumber));
      node.innerHTML =
        '<sup class="ocd-verse-number" style="display:' + (settings.showVerseNumbers ? 'inline' : 'none') + '">' +
        String(verseNumber) +
        '</sup>' +
        '<span class="ocd-verse-text">' + textHtml + '</span>';
    }

    function applyReadingSettings(settings) {
      if (!document.body) {
        return;
      }

      var body = document.body;
      var useDark = settings.theme === 'dark';

      body.classList.toggle('ocd-theme-dark', useDark);
      body.classList.toggle('ocd-verse-joining', Boolean(settings.verseJoining));
      body.style.fontFamily = settings.fontFamily && settings.fontFamily !== 'system'
        ? settings.fontFamily + ', "KoPub Batang", "Noto Serif KR", serif'
        : '"KoPub Batang", "Noto Serif KR", serif';
      body.style.fontSize = settings.fontSize ? String(settings.fontSize) + 'px' : '';
      body.style.lineHeight = settings.lineHeight ? String(settings.lineHeight) : '';
      body.style.fontWeight = settings.fontWeight || '';
      body.style.textAlign = settings.textAlign === 'justify' ? 'justify' : 'left';

      getCandidates().forEach(function (node) {
        wrapVerseNode(node, settings);
      });

      normalizeSectionHeaders();
      applyHighlights(currentHighlights);
      applySelection(currentSelection);
    }

    function clearHighlights() {
      document.querySelectorAll('.ocd-verse-node.ocd-highlight').forEach(function (node) {
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
        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
          return;
        }

        var color = COLOR_MAP[highlight.color] || COLOR_MAP.yellow;
        for (var verse = start; verse <= end; verse += 1) {
          var node = document.querySelector('.ocd-verse-node[data-verse-number="' + String(verse) + '"]');
          if (!node) {
            continue;
          }

          node.classList.add('ocd-highlight');
          node.style.setProperty('--verse-highlight-color', color);
        }
      });
    }

    function applySelection(range) {
      currentSelection = range && typeof range === 'object' ? range : null;

      document.querySelectorAll('.ocd-verse-node.ocd-selected').forEach(function (node) {
        node.classList.remove('ocd-selected');
      });

      if (!currentSelection) {
        return;
      }

      var start = Number(currentSelection.start);
      var end = Number(currentSelection.end);
      if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
        return;
      }

      for (var verse = start; verse <= end; verse += 1) {
        var node = document.querySelector('.ocd-verse-node[data-verse-number="' + String(verse) + '"]');
        if (node) {
          node.classList.add('ocd-selected');
        }
      }
    }

    document.addEventListener('click', function (event) {
      var target = event.target;
      var verseNode = target && target.closest ? target.closest('.ocd-verse-node') : null;
      var parentNode = target && target.closest ? target.closest('p, div, li, span, td') : null;
      var selectedText = window.getSelection ? window.getSelection().toString() : '';
      var text = cleanText(
        selectedText
          || (verseNode && verseNode.textContent)
          || (parentNode && parentNode.textContent)
          || (document.body && document.body.innerText)
          || ''
      );
      var verseNumber = verseNode && verseNode.getAttribute('data-verse-number')
        ? Number(verseNode.getAttribute('data-verse-number'))
        : inferVerseNumber(text, parentNode);

      window.parent.postMessage(
        {
          type: 'bible-verse-tap',
          text: text,
          verseNumber: Number.isFinite(verseNumber) ? verseNumber : null,
          x: event.clientX,
          y: event.clientY
        },
        '*'
      );
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

export default function BibleChapterView({
  book,
  chapter,
  version,
  content,
  isLoading,
  error,
  onRetry,
  onVerseTap,
  highlights = [],
  onHighlightsLoaded,
  readingSettings,
  selectedVerseRange,
}: BibleChapterViewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const interactiveContent = useMemo(() => buildInteractiveSrcDoc(content), [content])

  const syncHighlightsToIframe = useCallback(() => {
    const frame = iframeRef.current?.contentWindow
    if (!frame) {
      return
    }

    frame.postMessage(
      {
        type: 'bible-highlights-sync',
        highlights: highlights.map((highlight) => ({
          id: highlight.id,
          verseStart: highlight.verseStart,
          verseEnd: highlight.verseEnd,
          color: highlight.color,
        })),
      },
      '*'
    )
  }, [highlights])

  const syncReadingSettingsToIframe = useCallback(() => {
    const frame = iframeRef.current?.contentWindow
    if (!frame || !readingSettings) {
      return
    }

    frame.postMessage(
      {
        type: 'bible-reading-settings',
        settings: {
          theme: readingSettings.theme,
          fontFamily: readingSettings.fontFamily,
          fontSize: readingSettings.fontSize,
          lineHeight: readingSettings.lineHeight,
          fontWeight: readingSettings.fontWeight,
          textAlign: readingSettings.textAlign,
          showVerseNumbers: readingSettings.showVerseNumbers,
          verseJoining: readingSettings.verseJoining,
        },
      },
      '*'
    )
  }, [readingSettings])

  const syncSelectionToIframe = useCallback(() => {
    const frame = iframeRef.current?.contentWindow
    if (!frame) {
      return
    }

    frame.postMessage(
      {
        type: 'bible-selection-sync',
        selection: selectedVerseRange,
      },
      '*'
    )
  }, [selectedVerseRange])

  useEffect(() => {
    if (!onHighlightsLoaded) {
      return
    }

    const handleHighlightsLoaded = onHighlightsLoaded
    const controller = new AbortController()

    async function fetchHighlights() {
      try {
        const params = new URLSearchParams({
          book,
          chapter: String(chapter),
          version,
        })

        const response = await fetch(`/api/bible/highlights?${params.toString()}`, {
          signal: controller.signal,
        })

        if (!response.ok) {
          handleHighlightsLoaded([])
          return
        }

        const data = (await response.json()) as VerseHighlight[]
        handleHighlightsLoaded(data)
      } catch (caughtError) {
        if ((caughtError as Error).name !== 'AbortError') {
          handleHighlightsLoaded([])
        }
      }
    }

    fetchHighlights()
    return () => controller.abort()
  }, [book, chapter, version, onHighlightsLoaded])

  useEffect(() => {
    if (!onVerseTap) {
      return
    }

    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) {
        return
      }

      if (typeof event.data !== 'object' || event.data === null) {
        return
      }

      const payload = event.data as {
        type?: string
        text?: string
        verseNumber?: number | null
        x?: number
        y?: number
      }

      if (payload.type === 'bible-highlights-ready') {
        syncHighlightsToIframe()
        syncReadingSettingsToIframe()
        syncSelectionToIframe()
        return
      }

      if (payload.type !== 'bible-verse-tap') {
        return
      }

      onVerseTap({
        text: payload.text ?? '',
        verseNumber: typeof payload.verseNumber === 'number' ? payload.verseNumber : undefined,
        position:
          typeof payload.x === 'number' && typeof payload.y === 'number'
            ? { x: payload.x, y: payload.y }
            : undefined,
      })
    }

    window.addEventListener('message', handleMessage)

    return () => {
      window.removeEventListener('message', handleMessage)
    }
  }, [onVerseTap, syncHighlightsToIframe, syncReadingSettingsToIframe, syncSelectionToIframe])

  useEffect(() => {
    syncHighlightsToIframe()
  }, [syncHighlightsToIframe])

  useEffect(() => {
    syncReadingSettingsToIframe()
  }, [syncReadingSettingsToIframe])

  useEffect(() => {
    syncSelectionToIframe()
  }, [syncSelectionToIframe])

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-5 shadow-sm">
        <div className="space-y-3 animate-pulse">
          <div className="h-4 w-2/5 rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-4 w-full rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-4 w-[94%] rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-4 w-[88%] rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-4 w-[91%] rounded bg-[var(--color-bg-tertiary)]" />
          <div className="h-4 w-3/4 rounded bg-[var(--color-bg-tertiary)]" />
        </div>
      </section>
    )
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-6 shadow-sm">
        <div className="flex min-h-[22rem] flex-col items-center justify-center gap-3 text-center">
          <p className="text-base font-semibold text-[var(--color-text-primary)]">본문을 불러오지 못했습니다.</p>
          <p className="max-w-md text-sm text-[var(--color-text-secondary)]">{error}</p>
          {onRetry ? (
            <button
              type="button"
              onClick={onRetry}
              className="mt-2 rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-tertiary)] px-4 py-2 text-sm font-medium text-[var(--color-text-primary)] transition hover:opacity-90"
            >
              다시 시도
            </button>
          ) : null}
        </div>
      </section>
    )
  }

  return (
    <section className="rounded-2xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] p-2 shadow-sm">
      <iframe
        ref={iframeRef}
        data-testid="bible-chapter-content"
        title="bible-chapter-content"
        srcDoc={interactiveContent}
        className="h-[65vh] w-full rounded-xl border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)]"
        sandbox="allow-same-origin allow-scripts"
        onLoad={syncHighlightsToIframe}
      />
    </section>
  )
}
