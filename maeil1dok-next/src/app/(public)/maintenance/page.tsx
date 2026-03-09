export const metadata = {
  title: '시스템 점검 중 - 매일일독',
  description: '시스템 점검 중입니다. 잠시 후 다시 접속해 주세요.',
}

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="max-w-md text-center px-6">
        <div className="text-6xl mb-6">🔧</div>
        <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-4">
          시스템 점검 중입니다
        </h1>
        <p className="text-[var(--color-text-secondary)] mb-2">
          더 나은 서비스를 위해 시스템을 점검하고 있습니다.
        </p>
        <p className="text-[var(--color-text-secondary)] mb-6">
          잠시 후 다시 접속해 주세요.
        </p>
        <div className="bg-[var(--color-info-bg)] rounded-lg p-4 text-sm text-[var(--color-info-text)]">
          <p className="font-medium">점검 완료 후 다시 이용 가능합니다</p>
          <p className="mt-1">문의: 카카오톡 채널 또는 이메일</p>
        </div>
      </div>
    </div>
  )
}
