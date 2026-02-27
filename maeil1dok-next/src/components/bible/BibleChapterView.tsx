'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { VerseHighlight } from '@/types'
import type { UserReadingSettings } from '@/types/profile'

interface BibleChapterViewProps {
  book: string
  chapter: number
  version: string
  content: string
  isLoading: boolean
  onVerseTap?: (payload: { text: string; position?: { x: number; y: number } }) => void
  highlights?: VerseHighlight[]
  onHighlightsLoaded?: (highlights: VerseHighlight[]) => void
  readingSettings?: UserReadingSettings | null
}

function buildInteractiveSrcDoc(content: string) {
  const interactionScript = `
<script>
  (function () {
    var COLOR_MAP = {
      yellow: 'rgba(250, 204, 21, 0.45)',
      green: 'rgba(74, 222, 128, 0.4)',
      blue: 'rgba(96, 165, 250, 0.35)',
      pink: 'rgba(244, 114, 182, 0.35)',
      purple: 'rgba(192, 132, 252, 0.35)'
    };

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

      return Array.from(document.body.querySelectorAll('p, li, td, div, span'));
    }

    function applyReadingSettings(settings) {
      if (!settings || !document.body) {
        return;
      }

      var body = document.body;
      body.style.backgroundColor = settings.theme === 'dark' ? '#111827' : '#ffffff';
      body.style.color = settings.theme === 'dark' ? '#f3f4f6' : '#111827';
      body.style.fontFamily = settings.fontFamily && settings.fontFamily !== 'system' ? settings.fontFamily : '';
      body.style.fontSize = settings.fontSize ? String(settings.fontSize) + 'px' : '';
      body.style.lineHeight = settings.lineHeight ? String(settings.lineHeight) : '';
      body.style.fontWeight = settings.fontWeight || '';
      body.style.textAlign = settings.textAlign === 'justify' ? 'justify' : 'left';

      var candidates = getCandidates();
      candidates.forEach(function (node) {
        node.style.display = settings.verseJoining ? 'inline' : '';
        node.style.marginBottom = settings.verseJoining ? '0' : '';

        if (!node.getAttribute('data-base-html')) {
          node.setAttribute('data-base-html', node.innerHTML || '');
        }

        var baseHtml = node.getAttribute('data-base-html') || '';
        var verseNumber = inferVerseNumber(node.textContent || '', node);
        if (!verseNumber || /data-verse-flag/.test(baseHtml)) {
          return;
        }

        var wrappedHtml = baseHtml.replace(
          /^\s*(\d{1,3})(\s+)/,
          '<span data-verse-flag="1" data-verse-number="' + String(verseNumber) + '" style="display:' + (settings.showVerseNumbers ? 'inline' : 'none') + ';margin-right:2px;opacity:0.8;">$1</span>$2'
        );

        node.innerHTML = wrappedHtml;
        node.setAttribute('data-verse-number', String(verseNumber));
      });
    }

    function resetHighlights() {
      document.querySelectorAll('[data-highlight-color]').forEach(function (el) {
        el.style.backgroundColor = '';
        el.style.borderRadius = '';
        el.style.padding = '';
        el.removeAttribute('data-highlight-color');
      });
    }

    function applyHighlights(highlights) {
      resetHighlights();

      if (!Array.isArray(highlights) || !document.body) {
        return;
      }

      var candidates = getCandidates();

      highlights.forEach(function (highlight) {
        if (!highlight || typeof highlight !== 'object') {
          return;
        }

        var start = Number(highlight.verseStart);
        var end = Number(highlight.verseEnd);
        var color = COLOR_MAP[highlight.color] || COLOR_MAP.yellow;

        if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) {
          return;
        }

        candidates.forEach(function (node) {
          var verseNumber = inferVerseNumber(node.textContent || '', node);
          if (verseNumber === null) {
            return;
          }

          if (verseNumber >= start && verseNumber <= end) {
            node.style.backgroundColor = color;
            node.style.borderRadius = '6px';
            node.style.padding = '1px 2px';
            node.setAttribute('data-highlight-color', highlight.color);
          }
        });
      });
    }

    document.addEventListener('click', function (event) {
      var target = event.target;
      var parent = target && target.closest ? target.closest('p, div, li, span, td') : null;
      var selectedText = window.getSelection ? window.getSelection().toString() : '';
      var text = cleanText(selectedText || (parent && parent.textContent) || document.body.innerText || '');

      window.parent.postMessage(
        {
          type: 'bible-verse-tap',
          text: text,
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
    });

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
  onVerseTap,
  highlights = [],
  onHighlightsLoaded,
  readingSettings,
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
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
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
        x?: number
        y?: number
      }

      if (payload.type === 'bible-highlights-ready') {
        syncHighlightsToIframe()
        syncReadingSettingsToIframe()
        return
      }

      if (payload.type !== 'bible-verse-tap') {
        return
      }

      onVerseTap({
        text: payload.text ?? '',
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
  }, [onVerseTap, syncHighlightsToIframe, syncReadingSettingsToIframe])

  useEffect(() => {
    syncHighlightsToIframe()
  }, [syncHighlightsToIframe])

  useEffect(() => {
    syncReadingSettingsToIframe()
  }, [syncReadingSettingsToIframe])

  const themeClassName = readingSettings?.theme === 'dark'
    ? 'bg-gray-900 text-gray-100'
    : readingSettings?.theme === 'light'
      ? 'bg-white text-gray-900'
      : 'bg-white text-gray-900 dark:bg-gray-900 dark:text-gray-100'

  const textStyle = readingSettings
    ? {
        fontFamily: readingSettings.fontFamily === 'system' ? undefined : readingSettings.fontFamily,
        fontSize: `${readingSettings.fontSize}px`,
        lineHeight: readingSettings.lineHeight,
        fontWeight: readingSettings.fontWeight,
        textAlign: readingSettings.textAlign as 'left' | 'justify',
      }
    : {}

  if (isLoading) {
    return (
      <section className={`rounded-2xl p-6 shadow-sm ${themeClassName}`} style={textStyle}>
        <p className="text-sm text-gray-500">성경 본문을 불러오는 중입니다...</p>
      </section>
    )
  }

  return (
    <section className={`rounded-2xl p-2 shadow-sm ${themeClassName}`} style={textStyle}>
      <iframe
        ref={iframeRef}
        data-testid="bible-chapter-content"
        title="bible-chapter-content"
        srcDoc={interactiveContent}
        className="h-[65vh] w-full rounded-xl border border-gray-100 bg-white"
        sandbox="allow-same-origin allow-scripts"
        onLoad={syncHighlightsToIframe}
      />
    </section>
  )
}
