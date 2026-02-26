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
    <section className="px-4 pt-6 pb-4" data-testid="home-hero">
      <p className="text-sm text-gray-500 mb-1">{greetingMessage}</p>
      <h1
        className="text-3xl font-light leading-snug text-gray-900"
        style={{ fontFamily: 'Georgia, "KoPub Batang", serif' }}
      >
        {timeGreeting}
        <br />
        <strong className="font-bold">말씀과 동행하세요</strong>
      </h1>
    </section>
  )
}
