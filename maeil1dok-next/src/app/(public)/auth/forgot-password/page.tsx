'use client'

import { useMemo, useState } from 'react'
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

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [emailTouched, setEmailTouched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSubmitted, setIsSubmitted] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const normalizedEmail = email.trim()
  const emailError = useMemo(() => getEmailError(normalizedEmail), [normalizedEmail])
  const isFormValid = normalizedEmail.length > 0 && !emailError

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setEmailTouched(true)
    setSubmitError(null)

    if (!isFormValid) return

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(normalizedEmail, {
        redirectTo: `${window.location.origin}/auth/reset-password`,
      })

      if (error) throw error

      setIsSubmitted(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '재설정 메일 전송에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--color-bg-primary)' }}
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

        {!isSubmitted ? (
          <>
             <div className="text-center flex flex-col gap-2">
               <h1 className="text-xl font-semibold m-0" style={{ color: 'var(--color-text-primary)' }}>
                 비밀번호 재설정
               </h1>
               <p className="text-sm m-0 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                 가입할 때 사용한 이메일을 입력하시면
                 <br />
                 비밀번호 재설정 링크를 보내드립니다.
               </p>
             </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
               <div className="flex flex-col gap-1.5">
                 <label htmlFor="email" className="text-sm font-medium" style={{ color: 'var(--color-text-secondary)' }}>
                   이메일
                 </label>
                 <input
                   id="email"
                   type="email"
                   value={email}
                   onChange={(event) => setEmail(event.target.value)}
                   onBlur={() => setEmailTouched(true)}
                   autoComplete="email"
                   placeholder="example@email.com"
                   className="appearance-none block w-full py-3 px-4 text-sm rounded-md transition-all duration-200"
                   style={{
                     backgroundColor: 'var(--color-bg-card)',
                     color: 'var(--color-text-primary)',
                     border: emailTouched && emailError
                       ? '1px solid var(--color-danger)'
                       : '1px solid var(--color-border-subtle)',
                   }}
                 />
                 {emailTouched && emailError && <p className="text-xs m-0" style={{ color: 'var(--color-danger)' }}>{emailError}</p>}
               </div>

               <button
                 type="submit"
                 disabled={isLoading || !isFormValid}
                 className="w-full py-3 px-6 rounded-md text-sm font-medium border-none text-white transition-all duration-200"
                 style={{
                   backgroundColor: 'var(--color-primary)',
                   cursor: isLoading || !isFormValid ? 'not-allowed' : 'pointer',
                   opacity: isLoading || !isFormValid ? 0.7 : 1,
                 }}
               >
                 {isLoading ? '전송 중...' : '재설정 링크 보내기'}
               </button>
            </form>

             <div className="text-center text-sm">
               <Link href="/login" className="hover:underline" style={{ color: 'var(--color-text-secondary)' }}>
                 로그인으로 돌아가기
               </Link>
             </div>
          </>
        ) : (
           <div
             className="p-6 rounded-xl text-center flex flex-col gap-3"
             style={{
               backgroundColor: 'var(--color-bg-card)',
               boxShadow: 'var(--shadow-sm)',
             }}
           >
             <h2 className="text-xl font-semibold m-0" style={{ color: 'var(--color-text-primary)' }}>
               이메일을 확인해주세요
             </h2>
             <p className="text-sm m-0 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
               {normalizedEmail}로 비밀번호 재설정 링크를 보냈습니다.
               <br />
               이메일을 확인하여 비밀번호를 재설정해주세요.
             </p>
             <p className="text-xs m-0" style={{ color: 'var(--color-text-muted)' }}>
               이메일이 도착하지 않았다면 스팸 폴더를 확인해주세요.
             </p>
             <Link
               href="/login"
               className="w-full py-3 px-6 rounded-md text-sm font-medium border-none text-white transition-all duration-200"
               style={{
                 backgroundColor: 'var(--color-primary)',
                 display: 'inline-block',
               }}
             >
               로그인으로 이동
             </Link>
           </div>
        )}

        {submitError && (
          <div
            className="p-3 rounded-md text-sm"
            style={{
              backgroundColor: 'var(--color-danger-bg)',
              color: 'var(--color-danger-text)',
              border: '1px solid var(--color-danger)',
            }}
          >
            {submitError}
          </div>
        )}

         <div className="flex items-center justify-center gap-2 text-xs mt-2" style={{ color: 'var(--color-text-muted)' }}>
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
