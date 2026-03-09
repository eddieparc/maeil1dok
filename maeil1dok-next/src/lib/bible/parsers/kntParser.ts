import { cleanHtmlContent, NO_CONTENT_HTML, type ParseOptions, type ParseResult, processFootnotes } from '@/lib/bible/parsers/common'

interface KntPayload {
  found?: boolean
  reference?: string
  content?: string
}

interface VerseLine {
  text: string
  className: string
}

interface VerseData {
  lines: VerseLine[]
  order: number
}

interface ContentElement {
  type: 'section' | 'subtitle' | 'description' | 'crossref' | 'paragraph'
  index: number
  content: string
  className?: string
  fullMatch: string
}

const DEFAULT_OPTIONS: Required<ParseOptions> = {
  showVerseNumbers: true,
  showDescription: true,
  showCrossRef: true,
  showFootnotes: true,
}

function titleFromReference(reference?: string): string | undefined {
  if (!reference || !reference.trim()) {
    return undefined
  }

  if (/\d+(장|편)/.test(reference)) {
    return reference.trim()
  }

  if (/\d+$/.test(reference.trim())) {
    return `${reference.trim()}장`
  }

  return reference.trim()
}

function extractElements(contentHtml: string): ContentElement[] {
  const elements: ContentElement[] = []

  const sectionRegex = /<p class="s">([\s\S]*?)<\/p>/gi
  let sectionMatch = sectionRegex.exec(contentHtml)
  while (sectionMatch) {
    elements.push({
      type: 'section',
      index: sectionMatch.index,
      content: sectionMatch[1].trim(),
      fullMatch: sectionMatch[0],
    })
    sectionMatch = sectionRegex.exec(contentHtml)
  }

  const subtitleRegex = /<p class="sp">([\s\S]*?)<\/p>/gi
  let subtitleMatch = subtitleRegex.exec(contentHtml)
  while (subtitleMatch) {
    elements.push({
      type: 'subtitle',
      index: subtitleMatch.index,
      content: subtitleMatch[1].trim(),
      fullMatch: subtitleMatch[0],
    })
    subtitleMatch = subtitleRegex.exec(contentHtml)
  }

  const descriptionRegex = /<p class="d">([\s\S]*?)<\/p>/gi
  let descriptionMatch = descriptionRegex.exec(contentHtml)
  while (descriptionMatch) {
    const cleanText = cleanHtmlContent(
      processFootnotes(
        descriptionMatch[1]
          .replace(/<span[^>]*class="verse-span"[^>]*>/gi, '')
          .replace(/<span[^>]*class="v"[^>]*>\d+<\/span>/gi, ''),
        false
      )
    )
    if (cleanText) {
      elements.push({
        type: 'description',
        index: descriptionMatch.index,
        content: cleanText,
        fullMatch: descriptionMatch[0],
      })
    }
    descriptionMatch = descriptionRegex.exec(contentHtml)
  }

  const crossRefRegex = /<p class="r">([\s\S]*?)<\/p>/gi
  let crossRefMatch = crossRefRegex.exec(contentHtml)
  while (crossRefMatch) {
    const cleanText = cleanHtmlContent(crossRefMatch[1].replace(/<span[^>]*id="[^"]*"[^>]*>([^<]*)<\/span>/gi, '$1'))
    if (cleanText) {
      elements.push({
        type: 'crossref',
        index: crossRefMatch.index,
        content: cleanText,
        fullMatch: crossRefMatch[0],
      })
    }
    crossRefMatch = crossRefRegex.exec(contentHtml)
  }

  const paragraphRegex = /<p([^>]*)>([\s\S]*?)<\/p>/gi
  let paragraphMatch = paragraphRegex.exec(contentHtml)
  while (paragraphMatch) {
    const attrs = paragraphMatch[1] ?? ''
    const classMatch = attrs.match(/class="([^"]+)"/i)
    const className = classMatch?.[1]?.trim() || 'p'

    elements.push({
      type: 'paragraph',
      className,
      index: paragraphMatch.index,
      content: paragraphMatch[2] ?? '',
      fullMatch: paragraphMatch[0],
    })

    paragraphMatch = paragraphRegex.exec(contentHtml)
  }

  return elements.sort((a, b) => a.index - b.index)
}

function extractSpanBlocksByClass(html: string, className: string): string[] {
  const blocks: string[] = []
  const startPattern = new RegExp(`<span\\s+class="${className}"[^>]*>`, 'gi')

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
      blocks.push(html.slice(startIndex, endIndex))
      startPattern.lastIndex = endIndex
    }

    startMatch = startPattern.exec(html)
  }

  return blocks
}

function pushVerseLine(verseMap: Map<string, VerseData>, verseOrder: string[], verseNum: string, line: VerseLine, order: number): void {
  const existing = verseMap.get(verseNum)
  if (existing) {
    existing.lines.push(line)
    return
  }

  verseMap.set(verseNum, { lines: [line], order })
  verseOrder.push(verseNum)
}

export function parseKntContent(payload: unknown, options?: ParseOptions): ParseResult {
  const mergedOptions: Required<ParseOptions> = { ...DEFAULT_OPTIONS, ...options }
  const data = payload as KntPayload

  if (!data || typeof data !== 'object' || typeof data.content !== 'string' || !data.content.trim()) {
    return { html: NO_CONTENT_HTML, error: 'Invalid KNT payload' }
  }

  const allElements = extractElements(data.content)
  const rendered: Array<{ order: number; html: string }> = []
  const processedSubtitles = new Set<string>()
  const verseMap = new Map<string, VerseData>()
  const verseOrder: string[] = []

  allElements.forEach((element, elementIndex) => {
    if (element.type === 'section') {
      rendered.push({ order: elementIndex, html: `<h3 class="section-title">${element.content}</h3>` })
      return
    }

    if (element.type === 'subtitle') {
      if (!processedSubtitles.has(element.content)) {
        rendered.push({ order: elementIndex, html: `<p class="sub-title">${element.content}</p>` })
        processedSubtitles.add(element.content)
      }
      return
    }

    if (element.type === 'description') {
      if (mergedOptions.showDescription) {
        rendered.push({ order: elementIndex, html: `<p class="description">${element.content}</p>` })
      }
      return
    }

    if (element.type === 'crossref') {
      if (mergedOptions.showCrossRef) {
        rendered.push({ order: elementIndex, html: `<p class="cross-ref">${element.content}</p>` })
      }
      return
    }

    const dataVidMatch = element.fullMatch.match(/data-vid="[^:"]+:(\d+)"/i)
    const dataVidVerse = dataVidMatch?.[1]
    const verseSpans = extractSpanBlocksByClass(element.content, 'verse-span')

    let currentVerse: string | undefined
    let currentText = ''

    const flushVerse = () => {
      if (!currentVerse || !currentText.trim()) {
        return
      }

      pushVerseLine(
        verseMap,
        verseOrder,
        currentVerse,
        { text: currentText.trim(), className: element.className || 'p' },
        elementIndex
      )
      currentText = ''
    }

    if (verseSpans.length > 0) {
      verseSpans.forEach((spanHtml) => {
        const verseNumMatch = spanHtml.match(/<span[^>]*class="v"[^>]*>(\d+)<\/span>/i)
        const cleanedSpan = cleanHtmlContent(
          processFootnotes(
            spanHtml
              .replace(/<span[^>]*class="v"[^>]*>\d+<\/span>/i, '')
              .replace(/<span class="verse-span"[^>]*>/i, '')
              .replace(/<\/span>\s*$/i, ''),
            mergedOptions.showFootnotes
          ),
          mergedOptions.showFootnotes
        )

        if (verseNumMatch) {
          flushVerse()
          currentVerse = verseNumMatch[1]
          currentText = cleanedSpan
          return
        }

        if (!cleanedSpan) {
          return
        }

        if (!currentVerse && dataVidVerse) {
          currentVerse = dataVidVerse
          currentText = cleanedSpan
          return
        }

        if (currentVerse) {
          currentText = `${currentText} ${cleanedSpan}`.trim()
        }
      })

      flushVerse()
      return
    }

    const directVerseMatch = element.content.match(/^(?:<[^>]*>)*\s*(\d+)\s+([\s\S]+)$/i)
    if (directVerseMatch) {
      const verseNum = directVerseMatch[1]
      const verseText = cleanHtmlContent(processFootnotes(directVerseMatch[2], mergedOptions.showFootnotes), mergedOptions.showFootnotes)
      if (verseText) {
        pushVerseLine(
          verseMap,
          verseOrder,
          verseNum,
          { text: verseText, className: element.className || 'p' },
          elementIndex
        )
      }
      return
    }

    const poeticClasses = new Set(['q1', 'q2', 'q3', 'q4', 'm', 'pi1', 'pi2', 'nb', 'pc', 'pm', 'pmo', 'pmc'])
    const plain = cleanHtmlContent(processFootnotes(element.content, mergedOptions.showFootnotes), mergedOptions.showFootnotes)
    if (plain && element.className && poeticClasses.has(element.className)) {
      rendered.push({ order: elementIndex, html: `<div class="paragraph ${element.className}">${plain}</div>` })
    }
  })

  verseOrder.forEach((verseNum) => {
    const verseData = verseMap.get(verseNum)
    if (!verseData) {
      return
    }

    const linesHtml = verseData.lines
      .map((line, index) => {
        if (index === 0) {
          return `<div class="verse-line ${line.className}"><span class="verse-number">${verseNum}</span><span class="verse-text">${line.text}</span></div>`
        }
        return `<div class="verse-line continuation ${line.className}"><span class="verse-text">${line.text}</span></div>`
      })
      .join('')

    rendered.push({ order: verseData.order, html: `<div class="verse verse-group" data-verse-number="${verseNum}">${linesHtml}</div>` })
  })

  rendered.sort((a, b) => a.order - b.order)
  const html = rendered.map((entry) => entry.html).join('')

  return {
    html: html || NO_CONTENT_HTML,
    title: titleFromReference(data.reference),
    ...(html ? {} : { error: 'No readable KNT content' }),
  }
}
