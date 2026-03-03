'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { createClientRepositories } from '@/repositories/factory'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()
  const { auth } = createClientRepositories(supabase)

  async function signInWithKakao() {
    setIsLoading('kakao')
    setError(null)
    try {
      await auth.signInWithOAuth('kakao', `${window.location.origin}/auth/callback`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다')
      setIsLoading(null)
    }
  }

  async function signInWithGoogle() {
    setIsLoading('google')
    setError(null)
    try {
      await auth.signInWithOAuth('google', `${window.location.origin}/auth/callback`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다')
      setIsLoading(null)
    }
  }

  async function signInWithApple() {
    setIsLoading('apple')
    setError(null)
    try {
      await auth.signInWithOAuth('apple', `${window.location.origin}/auth/callback`)
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다')
      setIsLoading(null)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900">매일일독</h1>
          <p className="text-sm text-gray-500 mt-2">성경통독을 매일 함께해요</p>
        </div>
        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
            {error}
          </div>
        )}
        <div className="flex flex-col gap-3">
          <button
            onClick={signInWithKakao}
            disabled={isLoading !== null}
            className="w-full flex items-center justify-center py-3 px-4 rounded-xl font-medium text-sm disabled:opacity-60 bg-[var(--color-kakao)] text-[var(--color-kakao-text)]"
          >
            {isLoading === 'kakao' ? '로딩 중...' : '카카오 로그인'}
          </button>
          <button
            onClick={signInWithGoogle}
            disabled={isLoading !== null}
            className="w-full flex items-center justify-center py-3 px-4 rounded-xl font-medium text-sm border border-gray-200 bg-white text-gray-700 disabled:opacity-60"
          >
            {isLoading === 'google' ? '로딩 중...' : 'Google 로그인'}
          </button>
          <button
            onClick={signInWithApple}
            disabled={isLoading !== null}
            className="w-full flex items-center justify-center py-3 px-4 rounded-xl font-medium text-sm bg-black text-white disabled:opacity-60"
          >
            {isLoading === 'apple' ? '로딩 중...' : 'Apple 로그인'}
          </button>
        </div>
      </div>
    </div>
  )
}
