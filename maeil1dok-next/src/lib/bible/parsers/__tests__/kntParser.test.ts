import { describe, expect, it } from 'vitest'
import { parseKntContent } from '@/lib/bible/parsers/kntParser'

const KNT_SAMPLE = {
  found: true,
  reference: '창세기 1',
  content: [
    '<p class="s">천지 창조</p>',
    '<p class="d"><span class="verse-span"><span class="v">1</span>태초에 하나님이<span class="f"><span class="ft">또는 시작에</span></span> 천지를 창조하시니라</span></p>',
    '<p class="r">참조 <span id="x1">요 1:1</span></p>',
    '<p class="p" data-vid="GEN:1"><span class="verse-span"><span class="v">1</span>태초에 하나님이 천지를 창조하시니라</span></p>',
    '<p class="q1" data-vid="GEN:2"><span class="verse-span"><span class="v">2</span>땅이 혼돈하고 공허하며</span></p>',
    '<p class="q2" data-vid="GEN:2"><span class="verse-span">깊음 위에 어둠이 있고</span></p>',
  ].join(''),
}

describe('parseKntContent', () => {
  it('parses sections, descriptions, cross refs, and verse spans', () => {
    const result = parseKntContent(KNT_SAMPLE)

    expect(result.error).toBeUndefined()
    expect(result.title).toBe('창세기 1장')
    expect(result.html).toContain('<h3 class="section-title">천지 창조</h3>')
    expect(result.html).toContain('<p class="description">')
    expect(result.html).toContain('<p class="cross-ref">참조 요 1:1</p>')
    expect(result.html).toContain('<span class="verse-number">1</span>')
    expect(result.html).toContain('class="verse-line continuation q2"')
  })

  it('honors display options for description, cross refs, and footnotes', () => {
    const result = parseKntContent(KNT_SAMPLE, {
      showDescription: false,
      showCrossRef: false,
      showFootnotes: false,
    })

    expect(result.html).not.toContain('class="description"')
    expect(result.html).not.toContain('class="cross-ref"')
    expect(result.html).not.toContain('footnote-marker')
  })

  it('returns error result for malformed payload', () => {
    const result = parseKntContent({ found: true, content: '' })

    expect(result.error).toBeTruthy()
    expect(result.html).toContain('no-content')
  })
})
