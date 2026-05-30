export const metadata = {
  title: '시스템 점검 중 - 매일일독',
  description: '시스템 점검 중입니다. 잠시 후 다시 접속해 주세요.',
}

export default function MaintenancePage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="max-w-md text-center px-6">
        <div className="text-6xl mb-6">🔧</div>
        <h1
          className="text-[28px] font-medium text-[var(--color-ink)] -tracking-[0.03em] leading-[1.2] mb-4"
          style={{ fontFamily: 'var(--font-family-serif)' }}
        >
          시스템 점검 중입니다
        </h1>
        <p
          className="text-[14px] font-medium text-[var(--color-mute)] -tracking-[0.01em] mb-1.5"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          더 나은 서비스를 위해 시스템을 점검하고 있습니다
        </p>
        <p
          className="text-[14px] font-medium text-[var(--color-mute)] -tracking-[0.01em] mb-6"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          잠시 후 다시 접속해 주세요
        </p>
        <div
          className="bg-[var(--color-info-bg)] border border-[var(--color-info-border)] rounded-2xl p-4 text-[13px] -tracking-[0.008em] text-[var(--color-info-text)]"
          style={{ fontFamily: 'var(--font-family-ui)' }}
        >
          <p className="font-semibold">점검 완료 후 다시 이용 가능합니다</p>
          <p className="mt-1 font-medium opacity-90">문의: 카카오톡 채널 또는 이메일</p>
        </div>
      </div>
    </div>
  )
}
