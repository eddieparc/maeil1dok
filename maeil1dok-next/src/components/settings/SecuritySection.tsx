'use client'

import { useEffect, useMemo, useState } from 'react'
import { Modal } from '@/components/ui'
import type { User, UserIdentity } from '@/types'

interface SecuritySectionProps {
  user: User
  identities: UserIdentity[]
}

function isPasswordValid(password: string): boolean {
  return password.length >= 8 && /[A-Za-z]/.test(password) && /\d/.test(password)
}

export default function SecuritySection({ user, identities }: SecuritySectionProps) {
  const metadata = user.userMetadata as { has_password?: unknown } | undefined
  const hasPassword = metadata?.has_password === true
  const hasEmailIdentity = useMemo(
    () => identities.some((identity) => identity.provider === 'email') || hasPassword,
    [identities, hasPassword]
  )

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isSavingPassword, setIsSavingPassword] = useState(false)
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState('')

  const [deleteError, setDeleteError] = useState('')
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!passwordSuccess) return
    const timeoutId = window.setTimeout(() => setPasswordSuccess(''), 2200)
    return () => window.clearTimeout(timeoutId)
  }, [passwordSuccess])

  const isPasswordDirty =
    currentPassword.length > 0 ||
    newPassword.length > 0 ||
    confirmPassword.length > 0

  const resetPasswordForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')
    setPasswordError('')
    setPasswordSuccess('')
  }

  const handleSavePassword = async () => {
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

    if (hasPassword && currentPassword.trim().length === 0) {
      setPasswordError('현재 비밀번호를 입력해 주세요')
      return
    }

    setIsSavingPassword(true)
    try {
      const response = await fetch('/api/auth/update-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          hasPassword ? { newPassword, currentPassword } : { newPassword }
        ),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setPasswordError(data?.error ?? '비밀번호 저장에 실패했습니다')
        return
      }

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPasswordSuccess(hasPassword ? '비밀번호가 변경되었습니다' : '비밀번호가 설정되었습니다')
    } catch {
      setPasswordError('비밀번호 저장에 실패했습니다')
    } finally {
      setIsSavingPassword(false)
    }
  }

  const handleDeleteAccount = async () => {
    setDeleteError('')
    setIsDeleting(true)

    try {
      const response = await fetch('/api/auth/delete-account', { method: 'POST' })
      const data = await response.json().catch(() => null)

      if (!response.ok) {
        setDeleteError(data?.error ?? '계정 삭제에 실패했습니다')
        setIsDeleting(false)
        return
      }

      window.location.href = '/login'
    } catch {
      setDeleteError('계정 삭제에 실패했습니다')
      setIsDeleting(false)
    }
  }

  return (
    <section>
      <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-[0.05em] text-[var(--color-slate-500)]">보안</h2>

      <div className="rounded-xl border border-[var(--color-slate-200)] bg-[var(--color-bg-card)] p-4">
        <div>
          <p className="text-[0.9375rem] font-medium text-[var(--color-slate-800)]">비밀번호 {hasPassword ? '변경' : '설정'}</p>
          <p className="mt-1 text-[0.8125rem] text-[var(--color-slate-500)]">
            {hasEmailIdentity ? '이메일 로그인 보안을 위해 비밀번호를 관리하세요.' : '현재 소셜 로그인만 사용 중입니다.'}
          </p>
        </div>

        <div className="mt-4 space-y-4">
          {hasPassword && (
            <div>
              <label htmlFor="settings-current-password" className="text-[0.8125rem] font-medium text-[var(--color-slate-600)]">
                현재 비밀번호
              </label>
              <input
                id="settings-current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                autoComplete="current-password"
                className="mt-1 w-full rounded-lg border border-[var(--color-slate-300)] bg-[var(--color-bg-base)] px-3 py-3 text-[0.9375rem] text-[var(--color-slate-800)] outline-none transition focus:border-[var(--primary-color)]"
              />
            </div>
          )}

          <div>
            <label htmlFor="settings-new-password" className="text-[0.8125rem] font-medium text-[var(--color-slate-600)]">
              새 비밀번호
            </label>
            <input
              id="settings-new-password"
              type="password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              autoComplete="new-password"
              placeholder="8자 이상, 영문+숫자 포함"
              className="mt-1 w-full rounded-lg border border-[var(--color-slate-300)] bg-[var(--color-bg-base)] px-3 py-3 text-[0.9375rem] text-[var(--color-slate-800)] outline-none transition focus:border-[var(--primary-color)]"
            />
          </div>

          <div>
            <label htmlFor="settings-confirm-password" className="text-[0.8125rem] font-medium text-[var(--color-slate-600)]">
              비밀번호 확인
            </label>
            <input
              id="settings-confirm-password"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              autoComplete="new-password"
              className="mt-1 w-full rounded-lg border border-[var(--color-slate-300)] bg-[var(--color-bg-base)] px-3 py-3 text-[0.9375rem] text-[var(--color-slate-800)] outline-none transition focus:border-[var(--primary-color)]"
            />
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={resetPasswordForm}
            disabled={isSavingPassword || !isPasswordDirty}
            className="rounded-md border border-[var(--color-slate-300)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-slate-700)] transition hover:bg-[var(--color-slate-100)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSavePassword}
            disabled={isSavingPassword || !isPasswordDirty}
            className="rounded-md border border-[var(--primary-color)] bg-[var(--primary-color)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSavingPassword ? '저장 중...' : '저장'}
          </button>
        </div>

        {passwordError && <p className="mt-3 text-sm text-red-600">{passwordError}</p>}
        {passwordSuccess && <p className="mt-3 text-sm text-emerald-600">{passwordSuccess}</p>}

        <div className="mt-6 border-t border-[var(--color-slate-100)] pt-6">
          <p className="text-[0.9375rem] font-medium text-red-600">계정 삭제</p>
          <p className="mt-1 text-[0.8125rem] text-red-500">
            삭제 요청 후 30일간 유예 기간이 있으며 이후 완전히 삭제됩니다.
          </p>

          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(true)}
            className="mt-3 rounded-md border border-red-200 bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            계정 삭제
          </button>

          {deleteError && <p className="mt-3 text-sm text-red-600">{deleteError}</p>}
        </div>
      </div>

      <Modal isOpen={isDeleteModalOpen} onClose={() => !isDeleting && setIsDeleteModalOpen(false)} size="sm">
        <Modal.Header>
          <h3 className="text-base font-semibold text-[var(--color-slate-800)]">계정 삭제</h3>
        </Modal.Header>
        <Modal.Body>
          <p className="text-sm leading-6 text-[var(--color-slate-700)]">
            정말 계정을 삭제하시겠습니까?
            <br />
            삭제 요청 후 30일 동안은 로그인으로 복구할 수 있지만, 이후에는 모든 데이터가 영구 삭제됩니다.
          </p>
        </Modal.Body>
        <Modal.Footer>
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(false)}
            disabled={isDeleting}
            className="rounded-md border border-[var(--color-slate-300)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-slate-700)] transition hover:bg-[var(--color-slate-100)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleDeleteAccount}
            disabled={isDeleting}
            className="rounded-md border border-red-600 bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isDeleting ? '삭제 중...' : '계정 삭제'}
          </button>
        </Modal.Footer>
      </Modal>
    </section>
  )
}
