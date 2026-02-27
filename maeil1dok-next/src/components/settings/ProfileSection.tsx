'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import type { User, UserProfile } from '@/types'

interface ProfileSectionProps {
  user: User
  profile: UserProfile | null
}

export default function ProfileSection({ user, profile }: ProfileSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [avatarUrl, setAvatarUrl] = useState<string | null>(profile?.avatarUrl ?? null)
  const [nickname, setNickname] = useState(profile?.nickname ?? '')
  const [bio, setBio] = useState(profile?.bio ?? '')
  const [isUploading, setIsUploading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [showSuccess, setShowSuccess] = useState(false)

  const fallbackName = useMemo(() => {
    if (nickname.trim()) {
      return nickname.trim()
    }

    if (user.email?.trim()) {
      return user.email.trim()
    }

    return 'U'
  }, [nickname, user.email])

  useEffect(() => {
    if (!showSuccess) {
      return
    }

    const timeoutId = window.setTimeout(() => {
      setShowSuccess(false)
    }, 2000)

    return () => window.clearTimeout(timeoutId)
  }, [showSuccess])

  const handleAvatarButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.currentTarget.value = ''

    if (!file) {
      return
    }

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
        headers: {
          'Content-Type': 'application/json',
        },
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

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
      <div className="flex flex-col items-center">
        {avatarUrl ? (
          <img src={avatarUrl} alt="프로필 이미지" className="h-20 w-20 rounded-full object-cover" />
        ) : (
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-indigo-100 text-2xl font-bold text-indigo-600">
            {fallbackName.charAt(0).toUpperCase()}
          </div>
        )}

        <button
          type="button"
          className="mt-3 text-sm font-medium text-indigo-600 disabled:text-gray-400"
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

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="settings-nickname" className="text-sm font-medium text-gray-700">
            닉네임
          </label>
          <input
            id="settings-nickname"
            type="text"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={30}
            className="mt-1 w-full rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500"
          />
        </div>

        <div>
          <label htmlFor="settings-bio" className="text-sm font-medium text-gray-700">
            소개
          </label>
          <textarea
            id="settings-bio"
            value={bio}
            onChange={(event) => setBio(event.target.value)}
            maxLength={150}
            rows={4}
            className="mt-1 w-full resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-indigo-500"
          />
        </div>
      </div>

      <div className="mt-5 flex items-center gap-3">
        <button
          type="button"
          onClick={handleSave}
          disabled={isSaving}
          className="rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium text-white disabled:opacity-60"
        >
          {isSaving ? '저장 중...' : '저장'}
        </button>

        {showSuccess && <p className="text-sm text-green-600">저장되었습니다</p>}
        {errorMessage && <p className="text-sm text-red-500">{errorMessage}</p>}
      </div>
    </section>
  )
}
