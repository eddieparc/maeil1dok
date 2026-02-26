'use client'

import Link from 'next/link'

export function HasenaCard() {
  return (
    <Link href="/hasena" data-testid="card-hasena">
      <div className="mx-4 mb-4 p-5 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white shadow-sm">
        <div className="text-2xl mb-1">📖</div>
        <h3 className="text-lg font-bold">하세나하시조</h3>
        <p className="text-sm opacity-90 mt-1">오늘의 하세나하시조를 시청하세요</p>
        <div className="mt-3 text-sm font-medium">시청하기 →</div>
      </div>
    </Link>
  )
}
