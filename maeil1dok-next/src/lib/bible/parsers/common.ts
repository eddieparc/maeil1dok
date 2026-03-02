export interface ParseResult {
  html: string
  title?: string
  error?: string
}

export interface ParseOptions {
  showVerseNumbers?: boolean
  showDescription?: boolean
  showCrossRef?: boolean
  showFootnotes?: boolean
}

export const NO_CONTENT_HTML = '<p class="no-content">내용을 찾을 수 없습니다.</p>'

export function processFootnotes(text: string, showFootnotes = true): string {
  if (showFootnotes) {
    return text
      .replace(
        /<span[^>]*class="f"[^>]*>[\s\S]*?<span class="ft">([^<]*)<\/span>\s*<\/span>/gi,
        (_match, footnoteText: string) => {
          if (!footnoteText || !footnoteText.trim()) {
            return ''
          }

          const escapedText = footnoteText
            .trim()
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;')

          return `<sup class="footnote-marker" data-footnote="${escapedText}" title="${escapedText}">*</sup>`
        }
      )
      .replace(/<span[^>]*data-caller[^>]*>[\s\S]*?<\/span>\s*<\/span>\s*<\/span>/gi, '')
      .replace(/<span[^>]*data-caller[^>]*>[\s\S]*?<\/span>/gi, '')
  }

  return text
    .replace(/<span[^>]*class="f"[^>]*>.*?<\/span>.*?<\/span>.*?<\/span>/gi, '')
    .replace(/<span[^>]*data-caller[^>]*>.*?<\/span>.*?<\/span>.*?<\/span>/gi, '')
    .replace(/<span[^>]*data-caller[^>]*>.*?<\/span>/gi, '')
}

export function stripHtmlTags(text: string, preserveFootnoteMarkers = false): string {
  if (preserveFootnoteMarkers) {
    return text.replace(/<(?!\/sup\s*>|sup[^>]*class="footnote-marker")[^>]+>/g, '')
  }

  return text.replace(/<\/?[^>]+(>|$)/g, '')
}

export function cleanHtmlContent(text: string, preserveFootnoteMarkers = false): string {
  const decoded = text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")

  return stripHtmlTags(decoded, preserveFootnoteMarkers).replace(/\s+/g, ' ').trim()
}

export function preprocessFontTags(html: string): string {
  let processed = html
  let previousLength = 0
  let iterations = 0

  while (processed.length !== previousLength && iterations < 10) {
    previousLength = processed.length
    iterations += 1

    processed = processed
      .replace(/<font\s+class="name">([^<]*)<\/font>/gi, '<span class="bible-name">$1</span>')
      .replace(/<font\s+class="area">([^<]*)<\/font>/gi, '<span class="bible-area">$1</span>')
      .replace(/<font\s+class="orgin">([^<]*)<\/font>/gi, '$1')
  }

  processed = processed.replace(/<font\s+class="smallTitle">([\s\S]*?)<\/font>/gi, '<h4 class="section-title">$1</h4>')
  processed = processed.replace(/<font\s+class="chapNum">[^<]*<\/font>/gi, '')

  iterations = 0
  previousLength = 0
  while (processed.length !== previousLength && iterations < 10) {
    previousLength = processed.length
    iterations += 1
    processed = processed.replace(/<font[^>]*>([^<]*)<\/font>/gi, '$1')
  }

  return processed.replace(/<\/font>/gi, '')
}
