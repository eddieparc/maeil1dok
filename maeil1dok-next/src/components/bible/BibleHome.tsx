'use client'

import { BIBLE_BOOKS } from '@/lib/bible/books'

interface BibleHomeProps {
  lastPosition?: { book: string; chapter: number }
  onContinueReading: (book: string, chapter: number) => void
  onViewTOC: () => void
}

export default function BibleHome({ lastPosition, onContinueReading, onViewTOC }: BibleHomeProps) {
  return (
    <div className="flex flex-col gap-4 p-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">성경</h1>
      </header>

      {lastPosition ? (
        <section className="rounded-2xl bg-blue-600 p-5 shadow-sm">
          <p className="text-sm font-medium text-blue-200">마지막으로 읽은 곳</p>
          <p className="mt-1 text-xl font-bold text-white">
            {BIBLE_BOOKS[lastPosition.book]?.ko ?? lastPosition.book}{' '}
            {lastPosition.chapter}장
          </p>
          <button
            type="button"
            className="mt-3 w-full rounded-xl bg-white py-2.5 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
            onClick={() => onContinueReading(lastPosition.book, lastPosition.chapter)}
          >
            계속 읽기
          </button>
        </section>
      ) : (
        <section className="rounded-2xl bg-blue-50 p-5 text-center">
          <p className="text-sm text-blue-700">아직 읽은 기록이 없어요</p>
          <p className="mt-1 text-xs text-blue-500">목차에서 읽을 책을 선택하세요</p>
        </section>
      )}

      <button
        type="button"
        className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm transition hover:bg-gray-50"
        onClick={onViewTOC}
      >
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-100">
            <svg className="h-5 w-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h10" />
            </svg>
          </div>
          <div className="text-left">
            <p className="font-semibold text-gray-900">성경 목차</p>
            <p className="text-xs text-gray-500">구약 39권 · 신약 27권</p>
          </div>
        </div>
        <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </button>
    </div>
  )
}
