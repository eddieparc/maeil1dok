'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getEmailError(value: string): string {
  if (!value) return '이메일을 입력해주세요'
  if (!emailRegex.test(value)) return '올바른 이메일 형식이 아닙니다'
  return ''
}

type VerifyStatus = 'pending' | 'success' | 'error'

export default function VerifyEmailPage() {
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [status, setStatus] = useState<VerifyStatus>('pending')
  const [isLoading, setIsLoading] = useState(false)
  const [message, setMessage] = useState('인증 메일을 확인해주세요. 인증 링크를 눌러야 가입이 완료됩니다.')

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const initialEmail = params.get('email') ?? ''
    const statusParam = params.get('status')

    setEmail(initialEmail)

    if (statusParam === 'success') {
      setStatus('success')
      setMessage('이메일 인증이 완료되었습니다. 이제 로그인하여 서비스를 이용할 수 있습니다.')
      return
    }

    if (statusParam === 'error') {
      setStatus('error')
      setMessage('인증 링크가 만료되었거나 유효하지 않습니다.')
      return
    }

    setStatus('pending')
    setMessage('인증 메일을 확인해주세요. 인증 링크를 눌러야 가입이 완료됩니다.')
  }, [])

  const normalizedEmail = email.trim()
  const emailError = useMemo(() => getEmailError(normalizedEmail), [normalizedEmail])
  const canResend = normalizedEmail.length > 0 && !emailError

  async function handleResend() {
    setEmailTouched(true)
    if (!canResend) return

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: normalizedEmail,
      })

      if (error) throw error

      setStatus('pending')
      setMessage('인증 메일을 재발송했습니다. 이메일을 확인해주세요.')
    } catch (error) {
      setStatus('error')
      setMessage(error instanceof Error ? error.message : '인증 메일 재발송에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--color-bg-base)' }}
    >
      <div className="w-full max-w-[28rem] flex flex-col gap-6 fade-in">
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

        <div className="text-center">
          <Image
            src="/images/로고_투명.png"
            alt="매일일독"
            width={160}
            height={32}
            className="h-8 w-auto mx-auto"
            priority
          />
        </div>

        <div
          className="p-6 rounded-xl text-center flex flex-col gap-4"
          style={{
            backgroundColor: 'var(--color-bg-card)',
            boxShadow: 'var(--shadow-sm)',
          }}
        >
          <h1 className="text-xl font-semibold m-0" style={{ color: 'var(--color-slate-800)' }}>
            {status === 'success' ? '이메일 인증 완료!' : '이메일 인증 확인'}
          </h1>

          <p
            className="text-sm m-0 leading-relaxed"
            style={{
              color: status === 'error' ? 'var(--color-danger-text)' : 'var(--color-slate-600)',
            }}
          >
            {message}
          </p>

          {status !== 'success' && (
            <div className="flex flex-col gap-2 text-left">
              <label htmlFor="verify-email" className="text-sm font-medium" style={{ color: 'var(--color-slate-700)' }}>
                이메일
              </label>
              <input
                id="verify-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                onBlur={() => setEmailTouched(true)}
                autoComplete="email"
                placeholder="example@email.com"
                className="appearance-none block w-full py-3 px-4 text-sm rounded-md transition-all duration-200"
                style={{
                  backgroundColor: 'var(--color-bg-card)',
                  color: 'var(--color-slate-800)',
                  border: emailTouched && emailError
                    ? '1px solid #ef4444'
                    : '1px solid var(--color-slate-300)',
                }}
              />
              {emailTouched && emailError && <p className="text-xs m-0" style={{ color: '#ef4444' }}>{emailError}</p>}
            </div>
          )}

          {status === 'success' ? (
            <button
              type="button"
              onClick={() => router.push('/login')}
              className="w-full py-3 px-6 rounded-md text-sm font-medium border-none text-white transition-all duration-200"
              style={{ backgroundColor: 'var(--primary-color)' }}
            >
              로그인으로 이동
            </button>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isLoading || !canResend}
              className="w-full py-3 px-6 rounded-md text-sm font-medium border-none text-white transition-all duration-200"
              style={{
                backgroundColor: 'var(--primary-color)',
                cursor: isLoading || !canResend ? 'not-allowed' : 'pointer',
                opacity: isLoading || !canResend ? 0.7 : 1,
              }}
            >
              {isLoading ? '발송 중...' : '인증 메일 재발송'}
            </button>
          )}
        </div>

        <div className="text-center text-sm">
          <Link href="/login" className="hover:underline" style={{ color: 'var(--color-slate-600)' }}>
            로그인으로 돌아가기
          </Link>
        </div>

        <div className="flex items-center justify-center gap-2 text-xs mt-2" style={{ color: 'var(--color-slate-400)' }}>
          <Link href="/terms" className="hover:underline" style={{ color: 'inherit' }}>
            이용약관
          </Link>
          <span style={{ color: 'var(--color-slate-300)' }}>|</span>
          <Link href="/privacy" className="hover:underline" style={{ color: 'inherit' }}>
            개인정보처리방침
          </Link>
          <span style={{ color: 'var(--color-slate-300)' }}>|</span>
          <Link href="/company" className="hover:underline" style={{ color: 'inherit' }}>
            사업자 정보
          </Link>
        </div>
      </div>
    </div>
  )
}
