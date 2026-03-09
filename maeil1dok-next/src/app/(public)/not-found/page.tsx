import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[var(--color-bg-primary)]">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-[var(--color-text-primary)] mb-4">404</h1>
        <p className="text-xl text-[var(--color-text-secondary)] mb-8">
          페이지를 찾을 수 없습니다
        </p>
        <Link
          href="/"
          className="inline-block px-6 py-3 bg-[var(--color-info)] text-white font-medium rounded-lg hover:opacity-90 transition-opacity"
        >
          홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
