'use client'

import { useEffect, useState } from 'react'

interface HomeHeroProps {
  displayName?: string
  isAuthenticated?: boolean
}

const WEEKDAY_KO = ['일요일', '월요일', '화요일', '수요일', '목요일', '금요일', '토요일']

function formatToday(): string {
  const d = new Date()
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 · ${WEEKDAY_KO[d.getDay()]}`
}

function getTimeGreetingSuffix(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return '오늘 아침도'
  if (hour >= 12 && hour < 18) return '오늘 오후도'
  if (hour >= 18 && hour < 22) return '오늘 저녁도'
  return '오늘 밤도'
}

const SSR_GREETING_SUFFIX = '오늘도'

export default function HomeHero({ displayName = '방문자', isAuthenticated = true }: HomeHeroProps) {
  const [today, setToday] = useState<string>('')
  const [suffix, setSuffix] = useState<string>(SSR_GREETING_SUFFIX)

  useEffect(() => {
    setToday(formatToday())
    setSuffix(getTimeGreetingSuffix())
  }, [])

  const subject = isAuthenticated ? `${displayName} 님,` : '방문자 님,'

  return (
    <section className="mt-2 mb-5" data-testid="home-hero">
      <p
        className="mb-1.5 text-[12px] font-medium text-[var(--color-mute)] -tracking-[0.005em]"
        style={{ fontFamily: 'var(--font-family-ui)' }}
        suppressHydrationWarning
      >
        {today || '\u00A0'}
      </p>
      <h1
        className="text-[var(--color-ink)] leading-[1.2] -tracking-[0.03em]"
        style={{
          fontFamily: 'var(--font-family-serif)',
          fontSize: 'clamp(1.625rem, 6vw, 1.875rem)',
          fontWeight: 500,
        }}
      >
        {subject}
        <br />
        <span suppressHydrationWarning>{suffix} 함께 걸어요</span>
      </h1>
    </section>
  )
}
