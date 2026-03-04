'use client'

import { useState } from 'react'
import { BIBLE_VERSIONS, type BibleVersion } from '@/lib/bible/books'
import { Modal } from '@/components/ui/Modal'
import { cn } from '@/lib/utils'

/* ─── Version categories ─── */

const VERSION_CATEGORIES = {
  korean: ['GAE', 'KNT', 'WOORI', 'HAN', 'SAE', 'SAENEW', 'COG', 'COGNEW'] as BibleVersion[],
  // Ready for future expansion:
  // original: ['HEB', 'GRK'] as BibleVersion[],
  // english: ['ESV', 'NIV', 'KJV'] as BibleVersion[],
}

const NEW_VERSIONS = new Set<BibleVersion>(['KNT'])

/* ─── Component ─── */

interface VersionSelectorProps {
  version: BibleVersion
  onVersionChange: (version: BibleVersion) => void
}

export default function VersionSelector({ version, onVersionChange }: VersionSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)

  function handleSelect(v: BibleVersion) {
    onVersionChange(v)
    setIsOpen(false)
  }

  return (
    <>
      {/* Trigger button */}
      <button
        type="button"
        data-testid="version-selector"
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
          'bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)]',
          'hover:bg-[var(--color-button-hover)] hover:text-[var(--color-text-primary)]',
          'active:scale-[0.97]'
        )}
        onClick={() => setIsOpen(true)}
      >
        <span>{BIBLE_VERSIONS[version]}</span>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Version selection modal */}
      <Modal isOpen={isOpen} onClose={() => setIsOpen(false)} size="sm">
        <div className="px-5 pt-5 pb-2">
          <h2 className="text-center text-lg font-semibold text-[var(--color-text-primary)]">
            역본 선택
          </h2>
        </div>

        <div className="px-5 py-4">
          {/* Korean versions */}
          <VersionCategory
            title="한글 역본"
            versions={VERSION_CATEGORIES.korean}
            currentVersion={version}
            onSelect={handleSelect}
          />

          {/* Placeholder for original language versions */}
          {/* <VersionCategory title="원어 성경" versions={VERSION_CATEGORIES.original} ... /> */}

          {/* Placeholder for English versions */}
          {/* <VersionCategory title="영어 역본" versions={VERSION_CATEGORIES.english} ... /> */}
        </div>
      </Modal>
    </>
  )
}

/* ─── Version category group ─── */

function VersionCategory({
  title,
  versions,
  currentVersion,
  onSelect,
}: {
  title: string
  versions: BibleVersion[]
  currentVersion: BibleVersion
  onSelect: (v: BibleVersion) => void
}) {
  return (
    <div className="mb-5 last:mb-0">
      <h3 className="mb-2 pl-0.5 text-xs font-semibold uppercase tracking-wider text-[var(--color-text-muted)]">
        {title}
      </h3>
      <div className="flex flex-col gap-1">
        {versions.map((code) => {
          const isActive = currentVersion === code
          const isNew = NEW_VERSIONS.has(code)
          const name = BIBLE_VERSIONS[code]

          return (
            <button
              key={code}
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-xl px-3.5 py-3 text-left transition-all',
                isActive
                  ? 'bg-[var(--color-accent-light)] text-[var(--color-accent-primary)]'
                  : 'bg-[var(--color-bg-tertiary)] text-[var(--color-text-primary)] hover:bg-[var(--color-button-hover)]'
              )}
              onClick={() => onSelect(code)}
            >
              <span className={cn('text-[15px]', isActive && 'font-medium')}>
                {name}
                {isNew && (
                  <span className="ml-1.5 inline-flex items-center rounded bg-gradient-to-r from-indigo-500 to-violet-500 px-1.5 py-0.5 text-[10px] font-semibold text-white align-middle">
                    N
                  </span>
                )}
              </span>
              {isActive && (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" className="text-[var(--color-accent-primary)]">
                  <path d="M5 12l5 5L20 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
