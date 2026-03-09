'use client'

import { useMemo } from 'react'

interface HomeHeroProps {
  displayName?: string
  isAuthenticated?: boolean
}

function getTimeGreeting(): string {
  const hour = new Date().getHours()
  if (hour >= 5 && hour < 12) return '새로운 아침,'
  if (hour >= 12 && hour < 18) return '나른한 오후,'
  if (hour >= 18 && hour < 22) return '하루를 마무리하며'
  return '평안한 밤,'
}

export default function HomeHero({ displayName = '방문자', isAuthenticated = true }: HomeHeroProps) {
  const timeGreeting = useMemo(() => getTimeGreeting(), [])
  const greetingMessage = isAuthenticated ? `${displayName}님, 안녕하세요` : '방문자님, 환영합니다'

  return (
    <section className="mt-4 mb-3" data-testid="home-hero">
      <p
        className="mb-2 inline-flex rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-bg-card)] px-3 py-1 text-sm text-[var(--color-text-secondary)] shadow-[var(--shadow-card)]"
        style={{ fontSize: 'min(0.875rem, 14px)' }}
      >
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
        <strong className="relative inline-block font-bold text-[var(--color-text-primary)] after:absolute after:right-0 after:bottom-0 after:left-0 after:-z-10 after:h-3 after:rounded-full after:bg-[var(--color-accent-light)] after:content-['']">
          말씀과 동행하세요
        </strong>
      </h1>
    </section>
  )
}
