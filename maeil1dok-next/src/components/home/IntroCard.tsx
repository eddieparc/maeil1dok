'use client'

import Link from 'next/link'

export function IntroCard() {
  return (
    <Link href="/intro" data-testid="card-intro">
      <div className="mx-4 mb-4 p-5 rounded-2xl bg-gradient-to-br from-indigo-400 to-purple-500 text-white shadow-sm">
        <div className="text-2xl mb-1">📚</div>
        <h3 className="text-lg font-bold">성경개론</h3>
        <p className="text-sm opacity-90 mt-1">오늘의 성경개론을 시청하세요</p>
        <div className="mt-3 text-sm font-medium">시청하기 →</div>
      </div>
    </Link>
  )
}
