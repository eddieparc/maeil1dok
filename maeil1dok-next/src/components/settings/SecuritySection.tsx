import type { User } from '@/types'

interface SecuritySectionProps {
  user: User
}

export default function SecuritySection({ user: _user }: SecuritySectionProps) {
  return (
    <div className="py-8 text-center text-gray-500">
      <p>보안 설정</p>
      <p className="text-sm">곧 제공될 예정입니다</p>
    </div>
  )
}
