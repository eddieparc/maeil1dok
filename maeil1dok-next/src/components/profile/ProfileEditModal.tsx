'use client'

import { useState } from 'react'

interface ProfileEditModalProps {
  isOpen: boolean
  onClose: () => void
  initialNickname: string
  initialBio: string
  onSave: (nickname: string, bio: string) => void
}

export function ProfileEditModal({
  isOpen,
  onClose,
  initialNickname,
  initialBio,
  onSave,
}: ProfileEditModalProps) {
  const [nickname, setNickname] = useState(initialNickname)
  const [bio, setBio] = useState(initialBio)
  const [error, setError] = useState('')
  const [isSaving, setIsSaving] = useState(false)

  if (!isOpen) return null

  const handleSave = async () => {
    if (!nickname.trim()) {
      setError('닉네임은 필수입니다')
      return
    }
    setIsSaving(true)
    setError('')

    try {
      const res = await fetch('/api/profile/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ nickname: nickname.trim(), bio: bio.trim() }),
      })

      if (res.ok) {
        onSave(nickname.trim(), bio.trim())
        onClose()
      } else {
        setError('저장 중 오류가 발생했습니다')
      }
    } catch {
      setError('저장 중 오류가 발생했습니다')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="mx-4 w-full max-w-sm rounded-2xl bg-white p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="mb-4 text-lg font-bold">프로필 편집</h2>

        <div className="mb-4">
          <label className="text-sm font-medium text-gray-700">닉네임 *</label>
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className="mt-1 w-full rounded-xl border border-gray-300 p-2"
            placeholder="닉네임"
            maxLength={30}
          />
          {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
        </div>

        <div className="mb-6">
          <label className="text-sm font-medium text-gray-700">소개</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="mt-1 w-full resize-none rounded-xl border border-gray-300 p-2"
            placeholder="소개 (선택사항)"
            rows={3}
            maxLength={150}
          />
        </div>

        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 py-2 text-gray-700"
          >
            취소
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex-1 rounded-xl bg-blue-500 py-2 text-white disabled:opacity-50"
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}
