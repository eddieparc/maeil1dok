'use client'

import { useMemo } from 'react'

interface HomeHeroProps {
  displayName: string
}

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return '새로운 아침,'
  if (hour >= 12 && hour < 18) return '나른한 오후,'
  if (hour >= 18 && hour < 22) return '하루를 마무리하며'
  return '평안한 밤,'
}

export default function HomeHero({ displayName }: HomeHeroProps) {
  const timeGreeting = useMemo(() => getTimeGreeting(), [])
  const greetingMessage = `${displayName}님, 안녕하세요`

  return (
    <section className="mt-4 mb-2" data-testid="home-hero">
      <p className="mb-1 text-sm text-[var(--color-text-tertiary)]" style={{ fontSize: 'min(0.875rem, 14px)' }}>
        {greetingMessage}
      </p>
      <h1
        className="font-light leading-tight text-[var(--color-text-primary)]"
        style={{
          fontFamily: 'var(--font-family-reading)',
          fontSize: 'clamp(1.75rem, 5vw, 2rem)',
          lineHeight: 1.25,
        }}
      >
        {timeGreeting}
        <br />
        <strong className="relative font-bold">말쥍과 동행하세요</strong>
      </h1>
    </section>
  )
}
