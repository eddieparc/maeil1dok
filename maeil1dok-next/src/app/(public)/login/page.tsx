'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { createClientRepositories } from '@/repositories/factory'

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const router = useRouter()

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

  async function signInWithEmail() {
    if (!email || !password) return
    setIsLoading('email')
    setError(null)
    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      })
      if (signInError) throw signInError
      router.push('/bible')
    } catch (err) {
      setError(err instanceof Error ? err.message : '로그인 중 오류가 발생했습니다')
      setIsLoading(null)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
    >
      <div className="w-full max-w-[28rem] flex flex-col gap-8 fade-in">
        {/* Back Button */}
        <button
          type="button"
          onClick={() => router.back()}
          className="self-start flex items-center p-2 -m-2 transition-colors duration-200 hover:text-[var(--color-slate-800)]"
          style={{ color: 'var(--color-slate-500)' }}
          aria-label="뒤로 가기"
        >
          <svg aria-hidden="true" width="20" height="20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
        </button>

        {/* Logo */}
        <div className="text-center mb-4">
          <Image
            src="/images/로고_투명.png"
            alt="매일일독"
            width={160}
            height={32}
            className="h-8 w-auto mx-auto"
            priority
          />
        </div>

        {/* Social Login Buttons */}
        <div className="flex flex-col gap-3">
          {/* Kakao */}
          <button
            type="button"
            onClick={signInWithKakao}
            disabled={isLoading !== null}
            className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-md text-sm font-medium border-none cursor-pointer transition-all duration-200 hover:-translate-y-px active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed btn-interactive"
            style={{ backgroundColor: '#FEE500', color: '#000000' }}
          >
            {isLoading === 'kakao' ? (
              <span className="loading-spinner small" />
            ) : (
              <Image src="/images/kakao.png" alt="카카오 로고" width={16} height={16} />
            )}
            카카오로 시작하기
          </button>

           {/* Google */}
           <button
             type="button"
             onClick={signInWithGoogle}
             disabled={isLoading !== null}
             className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-md text-sm font-medium cursor-pointer transition-all duration-200 hover:-translate-y-px active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed btn-interactive"
             style={{
               backgroundColor: 'var(--color-bg-secondary)',
               color: 'var(--color-text-primary)',
               border: '1px solid var(--color-border-dark)',
             }}
           >
            {isLoading === 'google' ? (
              <span className="loading-spinner small" />
            ) : (
              <svg aria-hidden="true" width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
                <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
                <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
              </svg>
            )}
            구글로 시작하기
          </button>

           {/* Apple */}
           <button
             type="button"
             onClick={signInWithApple}
             disabled={isLoading !== null}
             className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-md text-sm font-medium border-none cursor-pointer transition-all duration-200 hover:-translate-y-px active:translate-y-0 disabled:opacity-60 disabled:cursor-not-allowed btn-interactive"
             style={{ backgroundColor: 'var(--color-text-primary)', color: 'var(--color-bg-primary)' }}
           >
            {isLoading === 'apple' ? (
              <span className="loading-spinner small" />
            ) : (
              <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/>
              </svg>
            )}
            Apple로 시작하기
          </button>
        </div>

        {/* Divider */}
        <div className="relative text-center my-2">
          <div className="absolute top-1/2 left-0 right-0 h-px" style={{ backgroundColor: 'var(--color-border-subtle)' }} />
          <span
            className="relative inline-block px-2 text-sm"
            style={{
              backgroundColor: 'var(--color-bg-primary)',
              color: 'var(--color-text-muted)',
            }}
          >
            또는 이메일/아이디로 계속
          </span>
        </div>

         {/* Email/Password Form */}
         <div className="flex flex-col gap-6">
           <div className="rounded-md overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
              <input
                type="text"
                placeholder="이메일 또는 아이디"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={isLoading !== null}
                className="block w-full py-3 px-4 text-sm border-b-0 rounded-t-md appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-subtle)',
                  borderBottom: 'none',
                }}
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') signInWithEmail()
                }}
                disabled={isLoading !== null}
                className="block w-full py-3 px-4 text-sm rounded-b-md appearance-none disabled:opacity-60 disabled:cursor-not-allowed"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-text-primary)',
                  border: '1px solid var(--color-border-subtle)',
                }}
              />
           </div>

           <button
             type="button"
             onClick={signInWithEmail}
             disabled={isLoading !== null || !email || !password}
             className="w-full py-3 px-6 rounded-md text-sm font-medium border-none text-white disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer transition-all duration-200 hover:-translate-y-px active:translate-y-0 btn-interactive"
             style={{ backgroundColor: 'var(--primary-color)' }}
           >
             {isLoading === 'email' ? '로그인 중...' : '로그인'}
           </button>

            <div className="flex flex-col items-center gap-2 text-sm">
              <span style={{ color: 'var(--color-text-muted)' }}>
                비밀번호를 잊으셨나요?
              </span>
              <Link
                href="/register-email"
                className="inline-block px-4 py-2 rounded-md font-medium hover:underline"
                style={{ color: 'var(--color-primary)' }}
              >
                이메일로 회원가입
              </Link>
            </div>
         </div>

        {/* Error Message */}
        {error && (
          <div
            className="p-3 rounded-md text-sm"
            style={{
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              border: '1px solid var(--color-danger)',
            }}
          >
            {error}
          </div>
        )}

         {/* Legal Links */}
         <div
           className="flex items-center justify-center gap-2 text-xs mt-2"
           style={{ color: 'var(--color-text-muted)' }}
         >
           <Link href="/terms" className="hover:underline" style={{ color: 'inherit' }}>
             이용약관
           </Link>
           <span style={{ color: 'var(--color-border-subtle)' }}>|</span>
           <Link href="/privacy" className="hover:underline" style={{ color: 'inherit' }}>
             개인정보처리방침
           </Link>
           <span style={{ color: 'var(--color-border-subtle)' }}>|</span>
           <Link href="/company" className="hover:underline" style={{ color: 'inherit' }}>
             사업자 정보
           </Link>
         </div>
      </div>
    </div>
  )
}
