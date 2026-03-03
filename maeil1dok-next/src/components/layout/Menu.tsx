'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { BookOpen, ClipboardList, Calendar, User, Settings, X } from 'lucide-react'
import { cn } from '@/lib/utils'

interface MenuProps {
  isOpen: boolean
  onClose: () => void
}

interface ActiveMenuItem {
  href: string
  label: string
  icon: React.ReactNode
}

interface DisabledMenuItem {
  label: string
  icon: React.ReactNode
}
const activeMenuItems: ActiveMenuItem[] = [
  { href: '/reading', label: '오늘일독', icon: <BookOpen size={22} /> },
  { href: '/plan', label: '성경통독표', icon: <ClipboardList size={22} /> },
  { href: '/plans', label: '플랜 관리', icon: <Calendar size={22} /> },
  { href: '/settings', label: '계정 설정', icon: <Settings size={22} /> },
]

const disabledMenuItems: DisabledMenuItem[] = [
  { label: '내 프로필', icon: <User size={22} /> },
]

export default function Menu({ isOpen, onClose }: MenuProps) {
  // ESC key handler
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Body scroll lock
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <div
      className={cn('fixed inset-0 z-[999]', isOpen ? 'pointer-events-auto' : 'pointer-events-none')}
      data-testid="menu"
    >
      {/* Overlay */}
      <button
        type="button"
        className={cn(
          'absolute inset-0 bg-black/25 backdrop-blur-sm transition-opacity duration-200',
          isOpen ? 'opacity-100' : 'opacity-0'
        )}
        onClick={onClose}
        aria-label="메뉴 닫기"
        data-testid="menu-overlay"
      />

      {/* Panel */}
      <div
        className={cn(
          'absolute right-0 top-0 flex h-full w-full max-w-[360px] flex-col bg-[var(--color-bg-primary)] shadow-[-4px_0_25px_rgba(0,0,0,0.15)] transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)]',
          isOpen ? 'translate-x-0' : 'translate-x-full'
        )}
        data-testid="menu-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-[var(--color-border-default)] px-4 py-4">
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">메뉴</h2>
          <button
            onClick={onClose}
            type="button"
            className="-mr-2 rounded-lg p-2 text-[var(--color-text-tertiary)] transition-colors hover:bg-[var(--color-bg-tertiary)]"
            aria-label="메뉴 닫기"
          >
            <X size={22} />
          </button>
        </div>

        {/* Menu items */}
        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {/* Active items */}
          <div className="space-y-1">
            {activeMenuItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={onClose}
                className="flex items-center gap-3 rounded-xl px-3 py-3 font-medium text-[var(--color-text-primary)] transition-all hover:bg-[var(--color-accent-light)] hover:text-[var(--color-primary)]"
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="my-3 border-t border-[var(--color-border-default)]" />

          {/* Disabled items */}
          <div className="space-y-1">
            {disabledMenuItems.map((item) => (
              <div
                key={item.label}
                className="flex cursor-not-allowed items-center gap-3 rounded-xl px-3 py-3 text-[var(--color-text-muted)] opacity-50"
                aria-disabled="true"
              >
                {item.icon}
                <span>{item.label}</span>
                <span className="ml-auto text-xs text-[var(--color-text-muted)]">준비 중</span>
              </div>
            ))}
          </div>
        </nav>

        {/* Footer - legal links */}
        <div className="border-t border-[var(--color-border-default)] px-4 py-4">
          <div className="flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
            <Link href="/terms" className="hover:underline" onClick={onClose}>이용약관</Link>
            <span>|</span>
            <Link href="/privacy" className="hover:underline" onClick={onClose}>개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
