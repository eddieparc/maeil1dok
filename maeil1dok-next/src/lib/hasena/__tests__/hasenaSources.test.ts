import { describe, expect, it } from 'vitest'
import {
  mergeHasenaCalendarEntries,
  parseHasenaBodyHtml,
  parseHasenaPlaylistFeed,
} from '../hasenaSources'

const playlistFeed = `<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns:yt="http://www.youtube.com/xml/schemas/2015" xmlns:media="http://search.yahoo.com/mrss/" xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <yt:videoId>_Apog7XmwkE</yt:videoId>
    <title>2026년 6월 26일 금요일 하세나하시조</title>
    <published>2026-06-25T15:00:22+00:00</published>
    <media:group>
      <media:description>[본문]
사무엘상 30:21-31

#하세나 #하시조</media:description>
    </media:group>
  </entry>
  <entry>
    <yt:videoId>private0000</yt:videoId>
    <title>Private video</title>
  </entry>
</feed>`

const hasenaHtml = `
<article id="bo_v">
  <li class="today">06 / 26 (금)</li>
</article>
<section id="bo_v_atc">
  <p class="bible_tit">사무엘상 30:21-31</p>
  <div class="bible_contents">
    <p><span class="bullet_number">21 </span><span class="bullet_txt">다윗이 브솔 개울 가까이에 이르니</span></p>
    <p><span class="bullet_number">22 </span><span class="bullet_txt">그러나 다윗과 함께 출전하였던 군인들</span></p>
  </div>
</section>`

describe('Hasena source parsing', () => {
  it('parses playlist video date and passage from YouTube feed descriptions', () => {
    const entries = parseHasenaPlaylistFeed(playlistFeed)

    expect(entries).toEqual([
      {
        videoId: '_Apog7XmwkE',
        videoDate: '2026-06-26',
        title: '2026년 6월 26일 금요일 하세나하시조',
        passage: '사무엘상 30:21-31',
        source: 'youtube-feed',
      },
    ])
  })

  it('parses Hasena body title and verse text from live write-page markup', () => {
    const parsed = parseHasenaBodyHtml(hasenaHtml)

    expect(parsed).toEqual({
      passage: '사무엘상 30:21-31',
      verses: [
        { number: '21', text: '다윗이 브솔 개울 가까이에 이르니' },
        { number: '22', text: '그러나 다윗과 함께 출전하였던 군인들' },
      ],
      bodyText: '21 다윗이 브솔 개울 가까이에 이르니\n22 그러나 다윗과 함께 출전하였던 군인들',
    })
  })

  it('merges cached entries and completion records into date-indexed calendar cells', () => {
    const entries = mergeHasenaCalendarEntries(
      [
        {
          date: '2026-06-26',
          passage: '사무엘상 30:21-31',
          videoId: '_Apog7XmwkE',
          title: '2026년 6월 26일 금요일 하세나하시조',
        },
      ],
      [
        { date: '2026-06-25', isCompleted: true },
        { date: '2026-06-26', isCompleted: true },
      ],
    )

    expect(entries).toEqual([
      {
        date: '2026-06-25',
        passage: '',
        videoId: '',
        title: '',
        isCompleted: true,
      },
      {
        date: '2026-06-26',
        passage: '사무엘상 30:21-31',
        videoId: '_Apog7XmwkE',
        title: '2026년 6월 26일 금요일 하세나하시조',
        isCompleted: true,
      },
    ])
  })
})
