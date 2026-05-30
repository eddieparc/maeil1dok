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
  const [showEmailForm, setShowEmailForm] = useState(false)
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
    <div className="min-h-screen bg-[var(--color-paper)] text-[var(--color-ink)]">
      <div className="mx-auto flex min-h-screen w-full max-w-[360px] flex-col justify-between px-6 pb-7 pt-14">
        <div>
          <span
            className="text-[16px] font-medium -tracking-[0.03em] text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-family-serif)' }}
          >
            매일일독
          </span>

          <h1
            className="mt-7 text-[38px] font-medium leading-[1.15] -tracking-[0.04em] text-[var(--color-ink)]"
            style={{ fontFamily: 'var(--font-family-serif)' }}
          >
            매일,
            <br />
            말씀과 함께
          </h1>

          <p
            className="mt-3 max-w-[260px] text-[14px] italic leading-[1.6] text-[var(--color-mute)] -tracking-[0.005em]"
            style={{ fontFamily: 'var(--font-family-serif)' }}
          >
            &ldquo;주의 말씀은 내 발에 등이요
            <br />내 길에 빛이니이다&rdquo; — 시편 119:105
          </p>

          <div className="mt-8 flex flex-col gap-2">
            <button
              type="button"
              onClick={signInWithKakao}
              disabled={isLoading !== null}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl px-3.5 py-2.5 text-[13px] font-semibold transition-all duration-150 hover:opacity-90 active:opacity-80 disabled:opacity-50 active:scale-[0.98]"
              style={{ backgroundColor: '#FEE500', color: '#000000' }}
            >
              {isLoading === 'kakao' ? (
                <span className="loading-spinner small" />
              ) : (
                <Image src="/images/kakao.png" alt="" width={14} height={14} aria-hidden="true" />
              )}
              카카오로 시작하기
            </button>

            <button
              type="button"
              onClick={signInWithGoogle}
              disabled={isLoading !== null}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-rule)] bg-[var(--color-paper)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--color-ink)] transition-all duration-150 hover:bg-[var(--color-brand-faint)] disabled:opacity-50 active:scale-[0.98]"
            >
              {isLoading === 'google' ? (
                <span className="loading-spinner small" />
              ) : (
                <svg aria-hidden="true" width="14" height="14" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
                  <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                  <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                  <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                  <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                </svg>
              )}
              Google로 시작하기
            </button>

            <button
              type="button"
              onClick={signInWithApple}
              disabled={isLoading !== null}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-[var(--color-ink)] bg-[var(--color-ink)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--color-paper)] transition-all duration-150 hover:opacity-90 disabled:opacity-50 active:scale-[0.98]"
            >
              {isLoading === 'apple' ? (
                <span className="loading-spinner small" />
              ) : (
                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
                </svg>
              )}
              Apple로 시작하기
            </button>
          </div>

          <div className="my-3 flex items-center gap-2.5">
            <div className="h-px flex-1 bg-[var(--color-rule)]" />
            <span className="text-[12px] text-[var(--color-subtle)]">또는</span>
            <div className="h-px flex-1 bg-[var(--color-rule)]" />
          </div>

          {!showEmailForm ? (
            <button
              type="button"
              onClick={() => setShowEmailForm(true)}
              className="w-full py-2 text-[13px] font-semibold text-[var(--color-ink)] underline underline-offset-[4px] decoration-[var(--color-rule)] hover:decoration-[var(--color-ink)]"
            >
              이메일로 계속하기
            </button>
          ) : (
            <div className="flex flex-col gap-2">
              <input
                type="text"
                placeholder="이메일 또는 아이디"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isLoading !== null}
                className="w-full rounded-xl border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2.5 text-[13px] text-[var(--color-ink)] placeholder-[var(--color-subtle)] -tracking-[0.008em] outline-none focus-visible:border-[var(--color-ink)] disabled:opacity-50"
              />
              <input
                type="password"
                placeholder="비밀번호"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') signInWithEmail()
                }}
                disabled={isLoading !== null}
                className="w-full rounded-xl border border-[var(--color-rule)] bg-[var(--color-paper)] px-3 py-2.5 text-[13px] text-[var(--color-ink)] placeholder-[var(--color-subtle)] -tracking-[0.008em] outline-none focus-visible:border-[var(--color-ink)] disabled:opacity-50"
              />
              <button
                type="button"
                onClick={signInWithEmail}
                disabled={isLoading !== null || !email || !password}
                className="w-full rounded-full bg-[var(--color-ink)] px-4 py-2.5 text-[13px] font-semibold text-[var(--color-paper)] -tracking-[0.012em] transition-all duration-150 hover:opacity-90 active:opacity-80 active:scale-[0.98] disabled:opacity-50"
              >
                {isLoading === 'email' ? '로그인 중...' : '로그인'}
              </button>
              <Link
                href="/register-email"
                className="text-center text-[12px] font-medium text-[var(--color-mute)] hover:text-[var(--color-ink)]"
              >
                이메일로 회원가입
              </Link>
            </div>
          )}

          {error && (
            <div
              className="mt-3 rounded-xl border px-3 py-2.5 text-[12px]"
              style={{
                backgroundColor: 'var(--color-danger-bg)',
                color: 'var(--color-danger-text)',
                borderColor: 'var(--color-danger-border)',
              }}
            >
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-center gap-2.5 text-[11px] text-[var(--color-subtle)]">
          <Link href="/terms" className="hover:text-[var(--color-mute)]">이용약관</Link>
          <span>·</span>
          <Link href="/privacy" className="hover:text-[var(--color-mute)]">개인정보</Link>
          <span>·</span>
          <Link href="/company" className="hover:text-[var(--color-mute)]">사업자 정보</Link>
        </div>
      </div>
    </div>
  )
}
