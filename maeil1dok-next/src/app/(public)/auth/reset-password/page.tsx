'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

function getPasswordError(value: string): string {
  if (!value) return '새 비밀번호를 입력해주세요'
  if (value.length < 8) return '비밀번호는 8자 이상이어야 합니다'
  return ''
}

function getPasswordConfirmError(password: string, passwordConfirm: string): string {
  if (!passwordConfirm) return '비밀번호 확인을 입력해주세요'
  if (password !== passwordConfirm) return '비밀번호가 일치하지 않습니다'
  return ''
}

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [passwordConfirmTouched, setPasswordConfirmTouched] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const router = useRouter()
  const supabase = createClient()

  const passwordError = useMemo(() => getPasswordError(password), [password])
  const passwordConfirmError = useMemo(
    () => getPasswordConfirmError(password, passwordConfirm),
    [password, passwordConfirm]
  )

  const isFormValid = useMemo(
    () => !passwordError && !passwordConfirmError,
    [passwordError, passwordConfirmError]
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPasswordTouched(true)
    setPasswordConfirmTouched(true)
    setSubmitError(null)

    if (!isFormValid) return

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) throw error
      setIsSuccess(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '비밀번호 변경에 실패했습니다')
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

        {!isSuccess ? (
          <>
             <div className="text-center flex flex-col gap-2">
               <h1 className="text-xl font-semibold m-0" style={{ color: 'var(--color-text-primary)' }}>
                 새 비밀번호 설정
               </h1>
               <p className="text-sm m-0 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
                 새로운 비밀번호를 입력해주세요.
               </p>
             </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div className="rounded-md overflow-hidden" style={{ boxShadow: 'var(--shadow-sm)' }}>
                 <input
                   id="password"
                   type="password"
                   value={password}
                   onChange={(event) => setPassword(event.target.value)}
                   onBlur={() => setPasswordTouched(true)}
                   autoComplete="new-password"
                   placeholder="새 비밀번호 (8자 이상)"
                   className="block w-full py-3 px-4 text-sm border-b-0 rounded-t-md appearance-none"
                   style={{
                     backgroundColor: 'var(--color-bg-card)',
                     color: 'var(--color-text-primary)',
                     border: passwordTouched && passwordError
                       ? '1px solid var(--color-danger)'
                       : '1px solid var(--color-border-subtle)',
                     borderBottom: 'none',
                   }}
                 />
                 <input
                   id="passwordConfirm"
                   type="password"
                   value={passwordConfirm}
                   onChange={(event) => setPasswordConfirm(event.target.value)}
                   onBlur={() => setPasswordConfirmTouched(true)}
                   autoComplete="new-password"
                   placeholder="비밀번호 확인"
                   className="block w-full py-3 px-4 text-sm rounded-b-md appearance-none"
                   style={{
                     backgroundColor: 'var(--color-bg-card)',
                     color: 'var(--color-text-primary)',
                     border: passwordConfirmTouched && passwordConfirmError
                       ? '1px solid var(--color-danger)'
                       : '1px solid var(--color-border-subtle)',
                   }}
                 />
              </div>

               {(passwordTouched && passwordError) || (passwordConfirmTouched && passwordConfirmError) ? (
                 <p className="text-xs m-0" style={{ color: 'var(--color-danger)' }}>
                   {passwordTouched && passwordError ? passwordError : passwordConfirmError}
                 </p>
               ) : null}

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
                 {isLoading ? '변경 중...' : '비밀번호 변경'}
               </button>
            </form>
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
               비밀번호 변경 완료!
             </h2>
             <p className="text-sm m-0 leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
               새 비밀번호로 로그인할 수 있습니다.
             </p>
             <button
               type="button"
               onClick={() => router.push('/login')}
               className="w-full py-3 px-6 rounded-md text-sm font-medium border-none text-white transition-all duration-200"
               style={{ backgroundColor: 'var(--color-primary)' }}
             >
               로그인으로 이동
             </button>
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

         <div className="text-center text-sm">
           <Link href="/auth/forgot-password" className="hover:underline" style={{ color: 'var(--color-text-secondary)' }}>
             링크가 만료되었나요? 다시 요청하기
           </Link>
         </div>

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
