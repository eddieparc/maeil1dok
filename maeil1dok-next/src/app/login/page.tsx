'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const supabase = createClient()

  async function signInWithKakao() {
    setIsLoading('kakao')
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'kakao',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setIsLoading(null) }
  }

  async function signInWithGoogle() {
    setIsLoading('google')
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setIsLoading(null) }
  }

  async function signInWithApple() {
    setIsLoading('apple')
    setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) { setError(error.message); setIsLoading(null) }
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
            className="w-full flex items-center justify-center py-3 px-4 rounded-xl font-medium text-sm disabled:opacity-60"
            style={{ backgroundColor: '#FEE500', color: '#191919' }}
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
