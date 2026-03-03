'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { BookOpen, ClipboardList, Calendar, User, Settings, X } from 'lucide-react'

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
      className={`fixed inset-0 z-[999] ${isOpen ? 'pointer-events-auto' : 'pointer-events-none'}`}
      data-testid="menu"
    >
      {/* Overlay */}
      <div
        className={`absolute inset-0 bg-black/25 backdrop-blur-sm transition-opacity duration-200 ${
          isOpen ? 'opacity-100' : 'opacity-0'
        }`}
        onClick={onClose}
        data-testid="menu-overlay"
      />

      {/* Panel */}
      <div
        className={`absolute right-0 top-0 h-full w-full max-w-[360px] bg-white shadow-[-4px_0_25px_rgba(0,0,0,0.15)] flex flex-col transition-transform duration-300 ease-[cubic-bezier(0.4,0,0.2,1)] ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
        onClick={(e) => e.stopPropagation()}
        data-testid="menu-panel"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-4 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">메뉴</h2>
          <button
            onClick={onClose}
            className="p-2 -mr-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
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
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-800 hover:bg-indigo-50 hover:text-indigo-600 transition-all font-medium"
              >
                {item.icon}
                <span>{item.label}</span>
              </Link>
            ))}
          </div>

          {/* Divider */}
          <div className="my-3 border-t border-gray-100" />

          {/* Disabled items */}
          <div className="space-y-1">
            {disabledMenuItems.map((item) => (
              <div
                key={item.label}
                className="flex items-center gap-3 px-3 py-3 rounded-xl text-gray-400 opacity-50 cursor-not-allowed"
                aria-disabled="true"
              >
                {item.icon}
                <span>{item.label}</span>
                <span className="ml-auto text-xs text-gray-400">준비 중</span>
              </div>
            ))}
          </div>
        </nav>

        {/* Footer - legal links */}
        <div className="px-4 py-4 border-t border-gray-100">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-400">
            <Link href="/terms" className="hover:underline" onClick={onClose}>이용약관</Link>
            <span>|</span>
            <Link href="/privacy" className="hover:underline" onClick={onClose}>개인정보처리방침</Link>
          </div>
        </div>
      </div>
    </div>
  )
}
