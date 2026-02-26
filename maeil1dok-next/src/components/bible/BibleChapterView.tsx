'use client'

import { useCallback, useEffect, useMemo, useRef } from 'react'
import type { VerseHighlight } from '@/types'

interface BibleChapterViewProps {
  book: string
  chapter: number
  version: string
  content: string
  isLoading: boolean
  onVerseTap?: (payload: { text: string; position?: { x: number; y: number } }) => void
  highlights?: VerseHighlight[]
  onHighlightsLoaded?: (highlights: VerseHighlight[]) => void
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

    function inferVerseNumber(text) {
      var match = cleanText(text).match(/^(\d{1,3})\b/);
      return match ? Number(match[1]) : null;
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

      var candidates = Array.from(document.body.querySelectorAll('p, li, td, div, span'));

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
          var verseNumber = inferVerseNumber(node.textContent || '');
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

      if (event.data.type !== 'bible-highlights-sync') {
        return;
      }

      applyHighlights(event.data.highlights || []);
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
  }, [onVerseTap, syncHighlightsToIframe])

  useEffect(() => {
    syncHighlightsToIframe()
  }, [syncHighlightsToIframe])

  if (isLoading) {
    return (
      <section className="rounded-2xl bg-white p-6 shadow-sm">
        <p className="text-sm text-gray-500">성경 본문을 불러오는 중입니다...</p>
      </section>
    )
  }

  return (
    <section className="rounded-2xl bg-white p-2 shadow-sm">
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
