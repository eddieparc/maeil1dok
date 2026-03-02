import { describe, expect, it } from 'vitest'
import { parseStandardContent } from '@/lib/bible/parsers/standardParser'

const STANDARD_SAMPLE = `
  <div id="tdBible1">
    <font class="chapNum">제1장</font>
    <font class="smallTitle">창조의 시작 <a href="#">(1:1-5)</a></font>
    <span><span class="number">1</span>태초에 <font class="name">여호와</font>께서 천지를 창조하시니라</span>
    <span><span class="number">2</span>땅이 혼돈하고 공허하며</span>
  </div>
`

describe('parseStandardContent', () => {
  it('parses section titles and numbered verses with TreeWalker flow', () => {
    const result = parseStandardContent(STANDARD_SAMPLE)

    expect(result.error).toBeUndefined()
    expect(result.title).toBe('제1장')
    expect(result.html).toContain('<h3 class="section-title">창조의 시작 <span class="reference">(1:1-5)</span></h3>')
    expect(result.html).toContain('<span class="verse-number">1</span>')
    expect(result.html).toContain('<span class="bible-name">여호와</span>')
  })

  it('returns an error when the expected bible container is missing', () => {
    const result = parseStandardContent('<div>no bible body</div>')

    expect(result.error).toBeTruthy()
    expect(result.html).toContain('no-content')
  })
})
