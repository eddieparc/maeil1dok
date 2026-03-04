'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useModal } from '@/hooks/useModal'

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function getEmailError(value: string): string {
  if (!value) return '이메일을 입력해주세요'
  if (!emailRegex.test(value)) return '올바른 이메일 형식이 아닙니다'
  return ''
}

function getNicknameError(value: string): string {
  if (!value) return '닉네임을 입력해주세요'
  if (value.length < 2) return '닉네임은 2자 이상이어야 합니다'
  return ''
}

function getPasswordError(value: string): string {
  if (!value) return '비밀번호를 입력해주세요'
  if (value.length < 8) return '비밀번호는 8자 이상이어야 합니다'
  if (!/[A-Za-z]/.test(value) || !/\d/.test(value)) return '비밀번호는 영문과 숫자를 모두 포함해야 합니다'
  return ''
}

function getPasswordConfirmError(password: string, passwordConfirm: string): string {
  if (!passwordConfirm) return '비밀번호 확인을 입력해주세요'
  if (password !== passwordConfirm) return '비밀번호가 일치하지 않습니다'
  return ''
}

export default function RegisterEmailPage() {
  const [email, setEmail] = useState('')
  const [nickname, setNickname] = useState('')
  const [password, setPassword] = useState('')
  const [passwordConfirm, setPasswordConfirm] = useState('')

  const [emailTouched, setEmailTouched] = useState(false)
  const [nicknameTouched, setNicknameTouched] = useState(false)
  const [passwordTouched, setPasswordTouched] = useState(false)
  const [passwordConfirmTouched, setPasswordConfirmTouched] = useState(false)

  const [isLoading, setIsLoading] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  const router = useRouter()
  const modal = useModal()
  const supabase = createClient()

  const normalizedEmail = email.trim()
  const normalizedNickname = nickname.trim()

  const emailError = useMemo(() => getEmailError(normalizedEmail), [normalizedEmail])
  const nicknameError = useMemo(() => getNicknameError(normalizedNickname), [normalizedNickname])
  const passwordError = useMemo(() => getPasswordError(password), [password])
  const passwordConfirmError = useMemo(
    () => getPasswordConfirmError(password, passwordConfirm),
    [password, passwordConfirm]
  )

  const isFormValid = useMemo(
    () => !emailError && !nicknameError && !passwordError && !passwordConfirmError,
    [emailError, nicknameError, passwordError, passwordConfirmError]
  )

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    setEmailTouched(true)
    setNicknameTouched(true)
    setPasswordTouched(true)
    setPasswordConfirmTouched(true)
    setSubmitError(null)

    if (!isFormValid) return

    setIsLoading(true)

    try {
      const { error } = await supabase.auth.signUp({
        email: normalizedEmail,
        password,
        options: {
          data: {
            nickname: normalizedNickname,
          },
        },
      })

      if (error) throw error

      await modal.alert({
        title: '회원가입 완료',
        description: `${normalizedEmail}로 인증 메일을 보냈습니다. 이메일을 확인해 주세요.`,
        icon: 'success',
      })

      router.push('/login')
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : '회원가입에 실패했습니다')
    } finally {
      setIsLoading(false)
    }
  }

  const emailSuccess = emailTouched && normalizedEmail.length > 0 && !emailError
  const nicknameSuccess = nicknameTouched && normalizedNickname.length > 0 && !nicknameError
  const passwordConfirmSuccess =
    passwordConfirmTouched && password.length > 0 && passwordConfirm.length > 0 && !passwordConfirmError

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

        <h1 className="text-center text-xl font-semibold m-0" style={{ color: 'var(--color-slate-800)' }}>
          이메일로 회원가입
        </h1>

        <form onSubmit={handleSubmit} className="flex flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="email" className="text-sm font-medium" style={{ color: 'var(--color-slate-700)' }}>
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
                color: 'var(--color-slate-800)',
                border: emailTouched && emailError
                  ? '1px solid #ef4444'
                  : emailSuccess
                    ? '1px solid #22c55e'
                    : '1px solid var(--color-slate-300)',
              }}
            />
            {emailTouched && emailError && <p className="text-xs m-0" style={{ color: '#ef4444' }}>{emailError}</p>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="nickname" className="text-sm font-medium" style={{ color: 'var(--color-slate-700)' }}>
              닉네임
            </label>
            <input
              id="nickname"
              type="text"
              value={nickname}
              onChange={(event) => {
                setNickname(event.target.value)
                setNicknameTouched(true)
              }}
              onBlur={() => setNicknameTouched(true)}
              autoComplete="nickname"
              placeholder="2자 이상 닉네임"
              className="appearance-none block w-full py-3 px-4 text-sm rounded-md transition-all duration-200"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                color: 'var(--color-slate-800)',
                border: nicknameTouched && nicknameError
                  ? '1px solid #ef4444'
                  : nicknameSuccess
                    ? '1px solid #22c55e'
                    : '1px solid var(--color-slate-300)',
              }}
            />
            {nicknameTouched && nicknameError && (
              <p className="text-xs m-0" style={{ color: '#ef4444' }}>{nicknameError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="password" className="text-sm font-medium" style={{ color: 'var(--color-slate-700)' }}>
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
                setPasswordTouched(true)
              }}
              onBlur={() => setPasswordTouched(true)}
              autoComplete="new-password"
              placeholder="8자 이상 (문자+숫자 포함)"
              className="appearance-none block w-full py-3 px-4 text-sm rounded-md transition-all duration-200"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                color: 'var(--color-slate-800)',
                border: passwordTouched && passwordError
                  ? '1px solid #ef4444'
                  : '1px solid var(--color-slate-300)',
              }}
            />
            {passwordTouched && passwordError && (
              <p className="text-xs m-0" style={{ color: '#ef4444' }}>{passwordError}</p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="passwordConfirm" className="text-sm font-medium" style={{ color: 'var(--color-slate-700)' }}>
              비밀번호 확인
            </label>
            <input
              id="passwordConfirm"
              type="password"
              value={passwordConfirm}
              onChange={(event) => {
                setPasswordConfirm(event.target.value)
                setPasswordConfirmTouched(true)
              }}
              onBlur={() => setPasswordConfirmTouched(true)}
              autoComplete="new-password"
              placeholder="비밀번호 재입력"
              className="appearance-none block w-full py-3 px-4 text-sm rounded-md transition-all duration-200"
              style={{
                backgroundColor: 'var(--color-bg-card)',
                color: 'var(--color-slate-800)',
                border: passwordConfirmTouched && passwordConfirmError
                  ? '1px solid #ef4444'
                  : passwordConfirmSuccess
                    ? '1px solid #22c55e'
                    : '1px solid var(--color-slate-300)',
              }}
            />
            {passwordConfirmTouched && passwordConfirmError && (
              <p className="text-xs m-0" style={{ color: '#ef4444' }}>{passwordConfirmError}</p>
            )}
          </div>

          <button
            type="submit"
            disabled={isLoading || !isFormValid}
            className="w-full py-3 px-6 rounded-md text-sm font-medium border-none text-white transition-all duration-200 mt-2"
            style={{
              backgroundColor: 'var(--primary-color)',
              cursor: isLoading || !isFormValid ? 'not-allowed' : 'pointer',
              opacity: isLoading || !isFormValid ? 0.7 : 1,
            }}
          >
            {isLoading ? '가입 중...' : '회원가입'}
          </button>

          <div className="text-center text-sm">
            <Link href="/login" className="inline-block px-4 py-2 rounded-md font-medium" style={{ color: 'var(--primary-color)' }}>
              이미 계정이 있으신가요? 로그인하기
            </Link>
          </div>
        </form>

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
