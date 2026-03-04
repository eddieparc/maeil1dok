'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { User, UserProfile } from '@/types'

interface ProfileSectionProps {
  user: User
  profile: UserProfile | null
}

export default function ProfileSection({ user, profile }: ProfileSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const initialAvatar = profile?.avatarUrl ?? null
  const initialNickname = profile?.nickname ?? ''
  const initialBio = profile?.bio ?? ''

  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatar)
  const [nickname, setNickname] = useState(initialNickname)
  const [bio, setBio] = useState(initialBio)
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  const fallbackName = useMemo(() => {
    if (nickname.trim()) return nickname.trim()
    if (user.email?.trim()) return user.email.trim()
    return 'U'
  }, [nickname, user.email])

  useEffect(() => {
    if (!showSuccess) return
    const timeoutId = window.setTimeout(() => setShowSuccess(false), 2000)
    return () => window.clearTimeout(timeoutId)
  }, [showSuccess])

  const isDirty =
    nickname.trim() !== initialNickname.trim() ||
    bio.trim() !== initialBio.trim() ||
    avatarUrl !== initialAvatar

  const handleAvatarButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''
    if (!file) return

    setErrorMessage('')
    setShowSuccess(false)
    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch('/api/profile/avatar', {
        method: 'POST',
        body: formData,
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setErrorMessage(data?.error ?? '프로필 사진 업로드에 실패했습니다')
        return
      }

      setAvatarUrl(data?.avatarUrl ?? null)
      setShowSuccess(true)
    } catch {
      setErrorMessage('프로필 사진 업로드에 실패했습니다')
    } finally {
      setIsUploading(false)
    }
  }

  const handleSave = async () => {
    setErrorMessage('')
    setShowSuccess(false)
    if (!nickname.trim()) {
      setErrorMessage('닉네임은 필수입니다')
      return
    }

    setIsSaving(true)
    try {
      const response = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: nickname.trim(),
          bio: bio.trim(),
        }),
      })

      const data = await response.json().catch(() => null)
      if (!response.ok) {
        setErrorMessage(data?.error ?? '프로필 저장 중 오류가 발생했습니다')
        return
      }

      setNickname((data?.nickname as string | undefined) ?? nickname.trim())
      setBio((data?.bio as string | undefined) ?? bio.trim())
      setShowSuccess(true)
    } catch {
      setErrorMessage('프로필 저장 중 오류가 발생했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  const handleCancel = () => {
    setNickname(initialNickname)
    setBio(initialBio)
    setAvatarUrl(initialAvatar)
    setErrorMessage('')
    setShowSuccess(false)
  }

  return (
    <section>
      <h2 className="mb-3 px-1 text-sm font-semibold uppercase tracking-[0.05em] text-[var(--color-slate-500)]">프로필</h2>

      <div className="rounded-xl border border-[var(--color-slate-200)] bg-[var(--color-bg-card)] p-4">
        <div className="flex items-center gap-4 rounded-xl border border-[var(--color-slate-200)] bg-[var(--color-bg-card)] p-4">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-full">
            {avatarUrl ? (
              <img src={avatarUrl} alt="프로필 이미지" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center bg-[var(--primary-light)] text-xl font-semibold text-[var(--primary-color)]">
                {fallbackName.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-semibold text-[var(--color-slate-800)]">{nickname.trim() || '닉네임 없음'}</p>
            <p className="truncate text-sm text-[var(--color-slate-500)]">{user.email ?? '이메일 없음'}</p>
          </div>

          <button
            type="button"
            className="rounded-md border border-[var(--color-slate-300)] bg-[var(--color-bg-card)] px-3 py-2 text-xs font-medium text-[var(--color-slate-700)] transition hover:bg-[var(--color-slate-100)] disabled:cursor-not-allowed disabled:opacity-50"
            onClick={handleAvatarButtonClick}
            disabled={isUploading}
          >
            {isUploading ? '업로드 중...' : '사진 변경'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>

        <div className="mt-4 space-y-4">
          <div>
            <label htmlFor="settings-nickname" className="text-[0.8125rem] font-medium text-[var(--color-slate-600)]">
              닉네임
            </label>
            <input
              id="settings-nickname"
              type="text"
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={30}
              className="mt-1 w-full rounded-lg border border-[var(--color-slate-300)] bg-[var(--color-bg-base)] px-3 py-3 text-[0.9375rem] text-[var(--color-slate-800)] outline-none transition focus:border-[var(--primary-color)]"
            />
          </div>

          <div>
            <label htmlFor="settings-bio" className="text-[0.8125rem] font-medium text-[var(--color-slate-600)]">
              소개
            </label>
            <textarea
              id="settings-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              maxLength={500}
              rows={4}
              className="mt-1 w-full resize-none rounded-lg border border-[var(--color-slate-300)] bg-[var(--color-bg-base)] px-3 py-3 text-[0.9375rem] text-[var(--color-slate-800)] outline-none transition focus:border-[var(--primary-color)]"
            />
            <p className="mt-1 text-right text-xs text-[var(--color-slate-500)]">{bio.length}/500</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={handleCancel}
            disabled={isSaving || !isDirty}
            className="rounded-md border border-[var(--color-slate-300)] bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-slate-700)] transition hover:bg-[var(--color-slate-100)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving || !isDirty}
            className="rounded-md border border-[var(--primary-color)] bg-[var(--primary-color)] px-4 py-2 text-sm font-medium text-white transition hover:bg-[var(--primary-dark)] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>

        {showSuccess && <p className="mt-3 text-sm text-emerald-600">저장되었습니다</p>}
        {errorMessage && <p className="mt-3 text-sm text-red-600">{errorMessage}</p>}
      </div>
    </section>
  )
}
