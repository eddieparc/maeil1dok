import type { Meta, StoryObj } from '@storybook/nextjs-vite'
import { HasenaClient } from './HasenaClient'
import { ReadingSettingsProvider } from '@/hooks/bible/ReadingSettingsContext'
import { ModalHost } from '@/components/ui/modal/ModalHost'

const today = '2026-06-26'
const pastDate = '2026-06-25'

const dayEntries = {
  [today]: {
    entry: {
      date: today,
      videoId: '_Apog7XmwkE',
      title: '2026년 6월 26일 금요일 하세나하시조',
      passage: '사무엘상 30:21-31',
      verses: [
        { number: '21', text: '다윗이 브솔 개울 가까이에 이르니, 낙오자들이 나와서 다윗을 환영하였다.' },
        { number: '22', text: '악하고 불량한 사람들은 낙오자들에게 전리품을 나눌 수 없다고 말하였다.' },
        { number: '23', text: '다윗이 말하였다. 주님께서 우리를 지켜 주셨으니 그렇게 해서는 안 된다.' },
      ],
    },
    isCompleted: false,
  },
  [pastDate]: {
    entry: {
      date: pastDate,
      videoId: 'rUQA4vO6bU0',
      title: '2026년 6월 25일 목요일 하세나하시조',
      passage: '사무엘상 30:1-20',
      verses: [
        { number: '6', text: '다윗은 주 하나님을 굳게 믿고 용기를 얻었다.' },
        { number: '18', text: '다윗은 아말렉 사람들이 빼앗아 간 것을 모두 되찾았다.' },
      ],
    },
    isCompleted: true,
  },
} as const

let isFetchMockInstalled = false

function installFetchMock() {
  if (isFetchMockInstalled) return
  isFetchMockInstalled = true

  const originalFetch = window.fetch.bind(window)

  window.fetch = async (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url
    const parsedUrl = new URL(url, window.location.origin)

    if (parsedUrl.pathname === '/api/hasena/day') {
      const date = parsedUrl.searchParams.get('date') ?? today
      return Response.json(dayEntries[date as keyof typeof dayEntries] ?? dayEntries[today])
    }

    if (parsedUrl.pathname === '/api/hasena/calendar') {
      return Response.json({
        entries: [
          {
            date: pastDate,
            passage: '사무엘상 30:1-20',
            videoId: 'rUQA4vO6bU0',
            title: '2026년 6월 25일 목요일 하세나하시조',
            isCompleted: true,
          },
          {
            date: today,
            passage: '사무엘상 30:21-31',
            videoId: '_Apog7XmwkE',
            title: '2026년 6월 26일 금요일 하세나하시조',
            isCompleted: false,
          },
        ],
      })
    }

    if (parsedUrl.pathname === '/api/hasena/complete') {
      const body = JSON.parse(String(init?.body ?? '{}')) as { date?: string; completed?: boolean }
      return Response.json({ date: body.date ?? today, isCompleted: Boolean(body.completed) })
    }

    if (parsedUrl.pathname === '/api/hasena/summary') {
      return Response.json({
        summary: [
          '**오늘의 본문**',
          '사무엘상 30장에서 다윗은 지친 사람들까지 공동체의 몫으로 품습니다.',
          '',
          '**교역자 해설**',
          '회복은 승리한 사람만의 전리품이 아니라 함께 지켜 낸 은혜입니다.',
          '',
          '**오늘 하시조**',
          '- 지친 사람을 배제하지 않기',
          '- 받은 은혜를 공동체와 나누기',
        ].join('\n'),
      })
    }

    return originalFetch(input, init)
  }

  window.addEventListener('pagehide', () => {
    window.fetch = originalFetch
    isFetchMockInstalled = false
  }, { once: true })
}

function HasenaClientStory() {
  if (typeof window !== 'undefined') {
    installFetchMock()
  }

  return (
    <ReadingSettingsProvider>
      <HasenaClient
        initialStatus={{ date: today, isCompleted: false }}
        initialStats={{ totalCompleted: 12, currentStreak: 3, longestStreak: 8 }}
        today={today}
        isAuthenticated
      />
      <ModalHost />
    </ReadingSettingsProvider>
  )
}

const meta = {
  title: 'Hasena/Client',
  component: HasenaClientStory,
  parameters: {
    layout: 'fullscreen',
    nextjs: {
      appDirectory: true,
    },
  },
} satisfies Meta<typeof HasenaClientStory>

export default meta

type Story = StoryObj<typeof meta>

export const CalendarNavigation: Story = {}
