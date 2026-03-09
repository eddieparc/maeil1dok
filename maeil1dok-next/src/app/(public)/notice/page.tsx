'use client'

import PageHeader from '@/components/ui/PageHeader'

interface Notice {
  id: number
  date: string
  title: string
  content: string
  isNew?: boolean
  highlights?: string[]
  actionText?: string
  actionLink?: string
}

const notices: Notice[] = [
  {
    id: 1,
    date: '2025년 03월 01일',
    title: '푸른통독 지원',
    content: '매일일독이 더욱 다양한 성경통독 플랜을 지원해요. 이제 청년부 푸른통독도 매일일독에서 함께 관리할 수 있어요.',
    isNew: true,
    highlights: [
      '여러 플랜을 동시에 구독하고 진행할 수 있어요',
      '각 플랜별로 진도와 통계를 별도 관리해요',
      '교역자를 위한 총회 목회달력도 지원 예정이예요',
    ],
    actionText: '자세히 보기',
    actionLink: '/notice/plan-update',
  },
  {
    id: 2,
    date: '2025년 02월 27일',
    title: '매일일독 앱 설치 안내',
    content: '매일일독을 앱처럼 사용할 수 있는 방법을 알려드려요.',
    actionText: '설치 방법 보기',
    actionLink: '/install',
  },
  {
    id: 3,
    date: '2025년 02월 24일',
    title: '매일일독 서비스 시작',
    content: '매일일독 서비스가 출시되었어요. 성경 통독을 더 편리하게 진행하실 수 있도록 최선을 다해 도와드릴게요.',
  },
]

export default function NoticePage() {
  return (
    <div className="max-w-2xl mx-auto bg-[var(--color-bg-tertiary)] min-h-screen">
      <div className="px-3 py-6">
        <PageHeader title="공지사항" />
      </div>

      <div className="px-3 pb-6 animate-fade-in" style={{ animationDelay: '0.2s' }}>
        {notices.map((notice) => (
          <div
            key={notice.id}
            className="bg-[var(--color-surface)] rounded-2xl p-6 mb-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5"
          >
            {/* Date */}
            <div className="text-xs text-[var(--color-text-secondary)] mb-3">{notice.date}</div>

            {/* Header with NEW badge */}
            <div className="flex items-center gap-2 mb-2">
              {notice.isNew && (
                <span className="bg-[var(--color-danger)] text-white text-xs font-semibold px-1.5 py-0.5 rounded">
                  NEW
                </span>
              )}
              <h2 className="text-xl font-bold text-[var(--color-text-primary)]">
                {notice.title}
              </h2>
            </div>

            {/* Content */}
            <div className="text-sm leading-relaxed text-[var(--color-text-secondary)] mb-4">
              {notice.content}
            </div>

            {/* Highlights */}
            {notice.highlights && notice.highlights.length > 0 && (
              <div className="bg-[var(--color-surface-secondary)] rounded-xl p-3 mb-4">
                {notice.highlights.map((highlight, idx) => (
                  <div key={idx} className="flex items-start gap-3 py-2 text-sm text-[var(--color-text-secondary)]">
                    <svg
                      className="w-5 h-5 flex-shrink-0 text-[var(--color-accent-primary)] mt-0.5"
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                      <polyline points="22 4 12 14.01 9 11.01"></polyline>
                    </svg>
                    <span>{highlight}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Action Button */}
            {notice.actionText && (
              <div className="flex justify-center">
                <button
                  onClick={() => {
                    if (notice.actionLink) {
                      window.location.href = notice.actionLink
                    }
                  }}
                  className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-[var(--color-accent-primary)] text-white rounded-lg font-semibold text-sm hover:opacity-90 transition-opacity duration-200"
                >
                  {notice.actionText}
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M9 6L15 12L9 18"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
