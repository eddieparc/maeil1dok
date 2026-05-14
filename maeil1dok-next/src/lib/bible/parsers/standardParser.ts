import { NO_CONTENT_HTML, preprocessFontTags, type ParseResult } from '@/lib/bible/parsers/common'

type WalkEntry =
  | { type: 'section'; index: number; title: string }
  | { type: 'verse'; index: number; number: string; text: string }

function getChapterTitle(sourceHtml: string): string | undefined {
  const match = sourceHtml.match(/<font\s+class="chapNum">([\s\S]*?)<\/font>/i)
  if (!match) {
    return undefined
  }
  return match[1].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim()
}

function cleanVerseText(html: string): string {
  const placeholders: string[] = []
  let text = html
    // Strip hidden footnote popups (e.g. <div class="D2" style="display:none">...</div>)
    .replace(/<div[^>]*style="[^"]*display\s*:\s*none[^"]*"[^>]*>[\s\S]*?<\/div>/gi, '')
    // Strip footnote/comment anchor links (e.g. <a class="comment">1)</a>)
    .replace(/<a[^>]*>[\s\S]*?<\/a>/gi, '')
    // Font tag processing
    .replace(/<font\s+class="name">([^<]*)<\/font>/gi, '<span class="bible-name">$1</span>')
    .replace(/<font\s+class="area">([^<]*)<\/font>/gi, '<span class="bible-area">$1</span>')
    .replace(/<font\s+class="orgin">([^<]*)<\/font>/gi, '$1')
    .replace(/<font[^>]*>([^<]*)<\/font>/gi, '$1')
    .replace(/<\/font>/gi, '')

  text = text.replace(/<span\s+class="bible-(name|area)">[^<]*<\/span>/gi, (token) => {
    placeholders.push(token)
    return `__BIBLE_PLACEHOLDER_${placeholders.length - 1}__`
  })

  text = text
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  return text
    .replace(/__BIBLE_PLACEHOLDER_(\d+)__/g, (_match, idx: string) => placeholders[Number(idx)] ?? '')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractSpanBlocks(html: string): Array<{ index: number; block: string }> {
  const blocks: Array<{ index: number; block: string }> = []
  const startPattern = /<span\b[^>]*>/gi

  let startMatch = startPattern.exec(html)
  while (startMatch) {
    const startIndex = startMatch.index
    const tagPattern = /<\/?span\b[^>]*>/gi
    tagPattern.lastIndex = startIndex

    let depth = 0
    let endIndex = -1
    let tagMatch = tagPattern.exec(html)
    while (tagMatch) {
      const tag = tagMatch[0]
      if (tag.startsWith('</')) {
        depth -= 1
      } else {
        depth += 1
      }

      if (depth === 0) {
        endIndex = tagPattern.lastIndex
        break
      }

      tagMatch = tagPattern.exec(html)
    }

    if (endIndex > startIndex) {
      blocks.push({ index: startIndex, block: html.slice(startIndex, endIndex) })
      startPattern.lastIndex = endIndex
    }

    startMatch = startPattern.exec(html)
  }

  return blocks
}

function parseByRegex(preprocessedHtml: string): WalkEntry[] {
  const entries: WalkEntry[] = []

  const sectionRegex = /<h4\s+class="section-title">([\s\S]*?)<\/h4>/gi
  let sectionMatch = sectionRegex.exec(preprocessedHtml)
  while (sectionMatch) {
    const titleText = sectionMatch[1]
      .replace(/<a[^>]*>/gi, '')
      .replace(/<\/a>/gi, '')
      .replace(/\(\s*\)/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/(\([^)]+\))/g, '<span class="reference">$1</span>')

    if (titleText) {
      entries.push({ type: 'section', index: sectionMatch.index, title: titleText })
    }
    sectionMatch = sectionRegex.exec(preprocessedHtml)
  }

  const seen = new Set<string>()

  extractSpanBlocks(preprocessedHtml).forEach(({ index, block }) => {
    const numberMatch = block.match(/<span[^>]*class="number"[^>]*>(\d+)<\/span>/i)
    if (!numberMatch) {
      return
    }

    const number = numberMatch[1].trim()
    if (seen.has(number)) {
      return
    }

    seen.add(number)
    const rawHtml = block.replace(/<span[^>]*class="number"[^>]*>.*?<\/span>/gi, '')

    entries.push({
      type: 'verse',
      index,
      number,
      text: cleanVerseText(rawHtml),
    })
  })

  return entries.sort((a, b) => a.index - b.index)
}

function parseByDom(preprocessedHtml: string): WalkEntry[] | null {
  const domParser = globalThis.DOMParser
  if (!domParser) {
    return null
  }

  const parser = new domParser()
  const doc = parser.parseFromString(preprocessedHtml, 'text/html')
  const bibleElement = doc.getElementById('tdBible1')
  if (!bibleElement) {
    return []
  }

  const entries: WalkEntry[] = []
  const seen = new Set<string>()

  const walker = doc.createTreeWalker(
    bibleElement,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode: (node) => {
        const element = node as Element
        if (element.tagName === 'H4' && element.classList.contains('section-title')) {
          return NodeFilter.FILTER_ACCEPT
        }
        if (element.classList.contains('number')) {
          return NodeFilter.FILTER_ACCEPT
        }
        return NodeFilter.FILTER_SKIP
      },
    }
  )

  let current = walker.nextNode()
  while (current) {
    const element = current as Element
    if (element.tagName === 'H4' && element.classList.contains('section-title')) {
      const titleText = (element.textContent ?? '')
        .replace(/\(\s*\)/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/(\([^)]+\))/g, '<span class="reference">$1</span>')

      if (titleText) {
        entries.push({ type: 'section', index: entries.length, title: titleText })
      }
    } else if (element.classList.contains('number')) {
      const number = (element.textContent ?? '').replace(/\s+/g, '')
      if (!seen.has(number)) {
        seen.add(number)
        const parentSpan = element.parentElement
        if (parentSpan) {
          const rawHtml = parentSpan.innerHTML.replace(/<span[^>]*class="number"[^>]*>.*?<\/span>/gi, '')
          entries.push({ type: 'verse', index: entries.length, number, text: cleanVerseText(rawHtml) })
        }
      }
    }

    current = walker.nextNode()
  }

  return entries
}

export function parseStandardContent(htmlText: string): ParseResult {
  if (!htmlText || !htmlText.trim()) {
    return { html: NO_CONTENT_HTML, error: 'Empty standard payload' }
  }

  const title = getChapterTitle(htmlText)
  const preprocessedHtml = preprocessFontTags(htmlText)

  if (!/id="tdBible1"/.test(preprocessedHtml)) {
    return { html: NO_CONTENT_HTML, title, error: 'Missing #tdBible1 container' }
  }

  const entries = parseByDom(preprocessedHtml) ?? parseByRegex(preprocessedHtml)
  if (!entries || entries.length === 0) {
    return { html: NO_CONTENT_HTML, title, error: 'No readable standard content' }
  }

  const html = entries
    .map((entry) => {
      if (entry.type === 'section') {
        return `<h3 class="section-title">${entry.title}</h3>`
      }

      return `<div class="verse" data-verse-number="${entry.number}"><span class="verse-number">${entry.number}</span><span class="verse-text">${entry.text}</span></div>`
    })
    .join('')

  return { html: html || NO_CONTENT_HTML, title, ...(html ? {} : { error: 'No readable standard content' }) }
}
