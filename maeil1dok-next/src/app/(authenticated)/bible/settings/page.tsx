'use client'

import Link from 'next/link'
import { BibleSettingsContent } from './BibleSettingsContent'

export default function BibleSettingsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary,#faf8f6)]">
      <header className="sticky top-0 z-10 flex items-center gap-2 border-b border-[var(--color-border-default,#e5e0d8)] bg-[var(--color-bg-card,#fff)] px-4 py-3">
        <Link
          href="/bible"
          className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--color-text-secondary,#6b7280)] transition-colors hover:bg-[var(--color-bg-hover,#f3f4f6)] hover:text-[var(--color-text-primary,#111)]"
          aria-label="뒤로 가기"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
        <h1 className="flex-1 text-lg font-semibold text-[var(--color-text-primary,#111)]">읽기 설정</h1>
      </header>
      <div className="mx-auto flex max-w-2xl flex-col gap-4 px-4 py-4 pb-8">
        <BibleSettingsContent />
      </div>
    </div>
  )
}
