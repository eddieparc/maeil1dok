import type { User } from '@/types'

interface NotificationsSectionProps {
  user: User
}

export default function NotificationsSection({ user: _user }: NotificationsSectionProps) {
  return (
    <div className="py-8 text-center text-gray-500">
      <p>알림 설정</p>
      <p className="text-sm">곧 제공될 예정입니다</p>
    </div>
  )
}
