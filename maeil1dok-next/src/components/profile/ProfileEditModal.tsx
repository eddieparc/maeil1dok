'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import Input from '@/components/ui/Input'
import Textarea from '@/components/ui/Textarea'
import Button from '@/components/ui/Button'
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
    <Modal isOpen={isOpen} onClose={onClose} size="sm">
      <Modal.Header>
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">프로필 편집</h2>
      </Modal.Header>
      <Modal.Body>
        <div className="flex flex-col gap-4">
          <Input
            label="닉네임 *"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            maxLength={30}
            error={error}
          />
          <Textarea
            label="소개"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="소개 (선택사항)"
            rows={3}
            maxLength={150}
            className="resize-none"
          />
        </div>
      </Modal.Body>
      <Modal.Footer>
        <div className="flex w-full gap-3">
          <Button variant="secondary" onClick={onClose} className="flex-1">
            취소
          </Button>
          <Button
            onClick={handleSave}
            loading={isSaving}
            className="flex-1"
          >
            저장
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  )
}
