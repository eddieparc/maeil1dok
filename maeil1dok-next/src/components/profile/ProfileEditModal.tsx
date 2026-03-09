'use client'

import { useEffect, useState } from 'react'
import { User } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import type { UserProfile } from '@/types'

interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
  profile: UserProfile
  onSave: (profile: UserProfile) => void
}

export function ProfileEditModal({
  isOpen,
  onClose,
  profile,
  onSave,
}: ProfileEditModalProps) {
  const [bio, setBio] = useState(profile.bio || '')
  const [isPublic, setIsPublic] = useState(profile.isPublic)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setBio(profile.bio || '')
    setIsPublic(profile.isPublic)
    setError('')
  }, [isOpen, profile.bio, profile.isPublic])

  const handleSave = async () => {
    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nickname: profile.nickname,
          bio: bio.trim(),
          isPublic,
        }),
      })

      if (!res.ok) {
        setError('저장 중 오류가 발생했습니다')
        return
      }

      const updated = (await res.json()) as UserProfile
      onSave(updated)
      onClose()
    } catch {
      setError('저장 중 오류가 발생했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <Modal.Header>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">프로필 편집</h2>
      </Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-5">
          <div className="space-y-2">
            <p className="text-sm font-semibold text-[var(--color-text-primary)]">프로필 이미지</p>
            <div className="flex items-center gap-4">
              {profile.avatarUrl ? (
                <img
                  src={profile.avatarUrl}
                  alt={profile.nickname}
                  className="h-16 w-16 rounded-full border-2 border-[var(--color-border-default)] object-cover"
                />
              ) : (
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)]">
                  <User size={28} aria-hidden="true" />
                </div>
              )}
              <p className="text-[13px] text-[var(--color-text-secondary)]">소셜 로그인 계정에서 가져옵니다.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="profile-nickname" className="text-sm font-semibold text-[var(--color-text-primary)]">
              닉네임
            </label>
            <input
              id="profile-nickname"
              type="text"
              value={profile.nickname}
              disabled
              className="h-10 w-full rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-secondary)] px-3 text-[15px] text-[var(--color-text-secondary)]"
            />
          </div>

          <div className="space-y-2">
            <label htmlFor="profile-bio" className="text-sm font-semibold text-[var(--color-text-primary)]">
              자기소개
            </label>
            <textarea
              id="profile-bio"
              value={bio}
              onChange={(event) => setBio(event.target.value)}
              rows={4}
              maxLength={500}
              placeholder="자신을 소개해주세요 (최대 500자)"
              className="min-h-[100px] w-full resize-y rounded-lg border border-[var(--color-border-default)] bg-[var(--color-bg-card)] px-3 py-2 text-[15px] text-[var(--color-text-primary)] outline-none transition-all placeholder:text-[var(--color-text-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary)]/30 focus:border-[var(--color-primary)]"
            />
            <p className="text-right text-[13px] text-[var(--color-text-secondary)]">{bio.length}/500</p>
          </div>

          <div>
            <label className="flex cursor-pointer items-center gap-2.5 text-[15px] text-[var(--color-text-primary)]">
              <input
                type="checkbox"
                checked={isPublic}
                onChange={(event) => setIsPublic(event.target.checked)}
                className="h-[18px] w-[18px] accent-[var(--color-primary)]"
              />
              프로필 공개
            </label>
            <p className="ml-7 mt-1 text-[13px] text-[var(--color-text-secondary)]">
              비공개로 설정하면 팔로워만 프로필을 볼 수 있습니다.
            </p>
          </div>

           {error ? (
             <p className="rounded-lg border border-[var(--color-error-border)] bg-[var(--color-error-bg)] px-3 py-2 text-[13px] text-[var(--color-error-text)]">{error}</p>
           ) : null}
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex w-full justify-end gap-3">
          <Button variant="secondary" onClick={onClose} className="h-10 rounded-lg px-5 text-sm">
            취소
          </Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            className="h-10 rounded-lg bg-[var(--color-primary)] px-5 text-sm text-white"
          >
            저장
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  )
}
