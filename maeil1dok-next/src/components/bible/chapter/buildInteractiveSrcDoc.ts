export function buildInteractiveSrcDoc(content: string) {
  const interactionScript = `
<style>
  :root {
    --bible-bg: #ffffff;
    --bible-text: #2a1111;
    --bible-border: #e5e7eb;
    --bible-muted: #999999;
    --bible-selection-bg: rgba(75, 159, 126, 0.18);
    --bible-selection-outline: #4b9f7e;
    --bible-header: var(--color-accent-primary, #4b9f7e);
    --bible-highlight-alpha: 0.46;
  }

  body {
    margin: 0;
    padding: 0.5rem;
    background: var(--bible-bg);
    color: var(--bible-text);
    font-family: var(--font-family-reading, "KoPub Batang"), "Noto Serif KR", serif;
    font-size: 1rem;
    line-height: 1.8;
    letter-spacing: -0.02em;
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
    font-size: 0.75em;
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

    var suppressClickUntil = 0;

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
        : 'var(--font-family-reading, "KoPub Batang"), "Noto Serif KR", serif';
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

    function getSelectionVerses(range) {
      var nodes = Array.from(document.querySelectorAll('.ocd-verse-node[data-verse-number]'));
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
      if (Date.now() < suppressClickUntil) {
        return;
      }

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
