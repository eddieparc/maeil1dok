import { useEffect, useMemo, useState } from 'react'
import type { User, UserIdentity } from '@/types'

interface SecuritySectionProps {
  user: User
  identities: UserIdentity[]
}

type OAuthProvider = 'kakao' | 'google' | 'apple'

const LINKABLE_PROVIDERS: OAuthProvider[] = ['kakao', 'google', 'apple']

function getProviderLabel(provider: string): string {
  if (provider === 'kakao') return '카카오'
  if (provider === 'google') return '구글'
  if (provider === 'apple') return '애플'
  if (provider === 'email') return '이메일'
  return provider
}

function formatDate(value: string): string {
  if (!value) return '-'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '-'
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  })
}

function isPasswordValid(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

export default function SecuritySection({ user, identities }: SecuritySectionProps) {
  const [linkedIdentities, setLinkedIdentities] = useState<UserIdentity[]>(identities)
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false)

  const [linkLoadingProvider, setLinkLoadingProvider] = useState<OAuthProvider | null>(null)
  const [unlinkLoadingIdentityId, setUnlinkLoadingIdentityId] = useState<string | null>(null)
  const [oauthError, setOauthError] = useState('')
  const [oauthSuccess, setOauthSuccess] = useState('')

  const [isResendingVerification, setIsResendingVerification] = useState(false)
  const [verificationCooldown, setVerificationCooldown] = useState(0)
  const [verificationError, setVerificationError] = useState('')
  const [verificationSuccess, setVerificationSuccess] = useState('')

  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false)
  const [isDeletingAccount, setIsDeletingAccount] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  useEffect(() => {
    setLinkedIdentities(identities)
  }, [identities])

  useEffect(() => {
    if (verificationCooldown <= 0) return

    const timerId = window.setInterval(() => {
      setVerificationCooldown((current) => {
        if (current <= 1) {
          window.clearInterval(timerId)
          return 0
        }
        return current - 1
      })
    }, 1000)

    return () => window.clearInterval(timerId)
  }, [verificationCooldown])

  const hasPassword = useMemo(() => {
    const metadata = user.userMetadata as { has_password?: unknown } | undefined
    return metadata?.has_password === true
  }, [user.userMetadata])

  const passwordTitle = hasPassword ? '비밀번호 변경' : '비밀번호 설정'
  const totalMethods = linkedIdentities.length + (hasPassword ? 1 : 0)
  const linkedProviders = useMemo(
    () => new Set(linkedIdentities.map((identity) => identity.provider)),
    [linkedIdentities]
  )
  const unlinkedProviders = LINKABLE_PROVIDERS.filter((provider) => !linkedProviders.has(provider))

  const handlePasswordSubmit = async (event: { preventDefault: () => void }) => {
    event.preventDefault()
    setPasswordError('')
    setPasswordSuccess('')

    if (!isPasswordValid(newPassword)) {
      setPasswordError('비밀번호는 8자 이상이며 영문과 숫자를 모두 포함해야 합니다')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordError('비밀번호 확인이 일치하지 않습니다')
      return
    }

    setIsSubmittingPassword(true)
    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ newPassword }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setPasswordError(data?.error ?? '비밀번호 변경에 실패했습니다')
        return
      }

      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(hasPassword ? '비밀번호가 변경되었습니다' : '비밀번호가 설정되었습니다')
    } catch {
      setPasswordError('비밀번호 변경에 실패했습니다')
    } finally {
      setIsSubmittingPassword(false)
    }
  }

  const handleUnlinkIdentity = async (identity: UserIdentity) => {
    setOauthError('')
    setOauthSuccess('')

    setUnlinkLoadingIdentityId(identity.identityId)
    try {
      const response = await fetch('/api/auth/unlink-identity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ identityId: identity.identityId }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setOauthError(data?.error ?? '연결 해제에 실패했습니다')
        return
      }

      setLinkedIdentities((current) => current.filter((item) => item.identityId !== identity.identityId))
      setOauthSuccess(`${getProviderLabel(identity.provider)} 연결이 해제되었습니다`)
    } catch {
      setOauthError('연결 해제에 실패했습니다')
    } finally {
      setUnlinkLoadingIdentityId(null)
    }
  }

  const handleLinkIdentity = async (provider: OAuthProvider) => {
    setOauthError('')
    setOauthSuccess('')

    setLinkLoadingProvider(provider)
    try {
      const response = await fetch('/api/auth/link-identity', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ provider }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok || !data?.url) {
        setOauthError(data?.error ?? '연결 요청에 실패했습니다')
        return
      }

      window.location.href = data.url as string
    } catch {
      setOauthError('연결 요청에 실패했습니다')
    } finally {
      setLinkLoadingProvider(null)
    }
  }

  const handleResendVerification = async () => {
    if (!user.email || verificationCooldown > 0) {
      return
    }

    setVerificationError('')
    setVerificationSuccess('')
    setIsResendingVerification(true)
    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action: 'resend-verification' }),
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setVerificationError(data?.error ?? '인증 메일 재발송에 실패했습니다')
        return
      }

      setVerificationSuccess('인증 메일을 다시 보냈습니다')
      setVerificationCooldown(60)
    } catch {
      setVerificationError('인증 메일 재발송에 실패했습니다')
    } finally {
      setIsResendingVerification(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteError('')
    setIsDeletingAccount(true)

    try {
      const response = await fetch('/api/auth/delete-account', {
        method: 'POST',
      })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setDeleteError(data?.error ?? '계정 삭제에 실패했습니다')
        return
      }

      window.location.href = '/login'
    } catch {
      setDeleteError('계정 삭제에 실패했습니다')
    } finally {
      setIsDeletingAccount(false)
    }
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div>
        <h2 className="text-base font-semibold text-gray-900">{passwordTitle}</h2>
        <form className="mt-3 space-y-3" onSubmit={handlePasswordSubmit}>
          <div>
            <label htmlFor="settings-new-password" className="text-sm font-medium text-gray-700">
              새 비밀번호
            </label>
            <input
              id="settings-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500"
              placeholder="8자 이상, 영문+숫자 포함"
            />
          </div>

          <div>
            <label htmlFor="settings-confirm-password" className="text-sm font-medium text-gray-700">
              비밀번호 확인
            </label>
            <input
              id="settings-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500"
            />
          </div>

          <button
            type="submit"
            disabled={isSubmittingPassword}
            className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmittingPassword ? '저장 중...' : hasPassword ? '변경하기' : '설정하기'}
          </button>
        </form>

        {passwordError && <p className="mt-2 text-sm text-red-500">{passwordError}</p>}
        {passwordSuccess && <p className="mt-2 text-sm text-green-600">{passwordSuccess}</p>}
      </div>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <h2 className="text-base font-semibold text-gray-900">OAuth 연결 관리</h2>

        <div className="mt-3 space-y-2">
          {linkedIdentities.map((identity) => {
            const canUnlink = totalMethods > 1
            const isUnlinking = unlinkLoadingIdentityId === identity.identityId

            return (
              <div key={identity.identityId} className="rounded-xl border border-gray-200 px-3 py-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{getProviderLabel(identity.provider)}</p>
                    <p className="text-xs text-gray-600">{identity.email ?? '이메일 정보 없음'}</p>
                    <p className="mt-1 text-xs text-gray-500">연결일 {formatDate(identity.createdAt)}</p>
                  </div>
                  <button
                    type="button"
                    disabled={!canUnlink || isUnlinking}
                    onClick={() => handleUnlinkIdentity(identity)}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isUnlinking ? '해제 중...' : '연결 해제'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {unlinkedProviders.length > 0 && (
          <div className="mt-4">
            <p className="text-sm font-medium text-gray-700">추가로 연결하기</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {unlinkedProviders.map((provider) => {
                const isLinking = linkLoadingProvider === provider
                return (
                  <button
                    key={provider}
                    type="button"
                    onClick={() => handleLinkIdentity(provider)}
                    disabled={isLinking || linkLoadingProvider !== null}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {isLinking ? '연결 중...' : `${getProviderLabel(provider)} 연결하기`}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {oauthError && <p className="mt-2 text-sm text-red-500">{oauthError}</p>}
        {oauthSuccess && <p className="mt-2 text-sm text-green-600">{oauthSuccess}</p>}
      </div>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <h2 className="text-base font-semibold text-gray-900">이메일 인증</h2>
        <p className="mt-2 text-sm text-gray-700">{user.email ?? '등록된 이메일이 없습니다'}</p>
        <p className={`mt-1 text-sm ${user.emailConfirmedAt ? 'text-green-600' : 'text-amber-600'}`}>
          {user.emailConfirmedAt ? '인증 완료' : '미인증'}
        </p>

        {!user.emailConfirmedAt && user.email && (
          <button
            type="button"
            onClick={handleResendVerification}
            disabled={isResendingVerification || verificationCooldown > 0}
            className="mt-3 rounded-xl border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isResendingVerification
              ? '재발송 중...'
              : verificationCooldown > 0
                ? `재발송 ${verificationCooldown}s`
                : '인증 메일 재발송'}
          </button>
        )}

        {verificationError && <p className="mt-2 text-sm text-red-500">{verificationError}</p>}
        {verificationSuccess && <p className="mt-2 text-sm text-green-600">{verificationSuccess}</p>}
      </div>

      <div className="mt-6 border-t border-gray-200 pt-6">
        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h2 className="text-base font-semibold text-red-700">계정 삭제</h2>
          <p className="mt-1 text-sm text-red-600">계정을 삭제하시겠습니까? 삭제 후 30일 내 복구 가능합니다.</p>

          {!isDeleteConfirmOpen ? (
            <button
              type="button"
              onClick={() => setIsDeleteConfirmOpen(true)}
              className="mt-3 rounded-xl bg-red-600 px-4 py-2 text-sm font-semibold text-white"
            >
              계정 삭제
            </button>
          ) : (
            <div className="mt-4 rounded-xl border border-red-200 bg-white p-3">
              <p className="text-sm text-gray-700">계정을 삭제하시겠습니까? 삭제 후 30일 내 복구 가능합니다.</p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsDeleteConfirmOpen(false)}
                  disabled={isDeletingAccount}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  취소
                </button>
                <button
                  type="button"
                  onClick={handleDeleteAccount}
                  disabled={isDeletingAccount}
                  className="rounded-lg bg-red-600 px-3 py-1.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isDeletingAccount ? '삭제 중...' : '계정 삭제'}
                </button>
              </div>
            </div>
          )}

          {deleteError && <p className="mt-2 text-sm text-red-600">{deleteError}</p>}
        </div>
      </div>
    </section>
  )
}
