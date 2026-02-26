'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createClientRepositories } from '@/repositories/factory'
import { useRouter } from 'next/navigation'
import type { User } from '@/types'

interface HeaderProps {
  user: User
}

export default function Header({ user }: HeaderProps) {
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()
  const { auth } = createClientRepositories(supabase)

  async function handleSignOut() {
    setIsLoading(true)
    try {
      await auth.signOut()
      router.push('/login')
    } catch (error) {
      console.error('Sign out error:', error)
      setIsLoading(false)
    }
  }

  const displayName = user.email || '사용자'

  return (
    <header className="bg-white border-b border-gray-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div className="text-lg font-semibold text-gray-900">
          매일일독
        </div>
        <div className="flex items-center gap-4">
          <span className="text-sm text-gray-600">
            {displayName}
          </span>
          <button
            onClick={handleSignOut}
            disabled={isLoading}
            className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 disabled:opacity-60 transition-colors"
          >
            {isLoading ? '로딩 중...' : '로그아웃'}
          </button>
        </div>
      </div>
    </header>
  )
}
