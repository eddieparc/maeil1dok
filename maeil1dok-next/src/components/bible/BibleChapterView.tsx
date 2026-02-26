'use client'

import { useEffect, useMemo, useRef } from 'react'

interface BibleChapterViewProps {
  content: string
  isLoading: boolean
  onVerseTap?: (payload: { text: string; position?: { x: number; y: number } }) => void
}

function buildInteractiveSrcDoc(content: string) {
  const interactionScript = `
<script>
  (function () {
    function cleanText(value) {
      return (value || '').replace(/\s+/g, ' ').trim();
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
  })();
</script>
`

  if (content.includes('</body>')) {
    return content.replace('</body>', `${interactionScript}</body>`)
  }

  return `${content}${interactionScript}`
}

export default function BibleChapterView({ content, isLoading, onVerseTap }: BibleChapterViewProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const interactiveContent = useMemo(() => buildInteractiveSrcDoc(content), [content])

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
  }, [onVerseTap])

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
      />
    </section>
  )
}
