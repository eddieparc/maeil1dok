import { describe, expect, it } from 'vitest'
import { parseWooriContent } from '@/lib/bible/parsers/wooriParser'

describe('parseWooriContent', () => {
  it('converts verses array payload to html blocks', () => {
    const result = parseWooriContent({
      found: true,
      verses: [
        { verse: 1, text: '태초에 하나님이 천지를 창조하셨습니다.' },
        { verse: 2, text: '땅은 혼돈하고 공허했습니다.' },
      ],
    })

    expect(result.error).toBeUndefined()
    expect(result.html).toContain('<span class="verse-number">1</span>')
    expect(result.html).toContain('태초에 하나님이 천지를 창조하셨습니다.')
  })

  it('returns error result when verses payload is invalid', () => {
    const result = parseWooriContent({ found: true, verses: [] })

    expect(result.error).toBeTruthy()
    expect(result.html).toContain('no-content')
  })
})
