'use client'

import PageHeader from '@/components/ui/PageHeader'
import Link from 'next/link'

export default function SupportPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <PageHeader title="고객지원" />

      <div className="max-w-[768px] mx-auto px-4 py-6">
        <div className="bg-[var(--color-bg-card)] rounded-[20px] shadow-[var(--shadow-md)] border border-[var(--color-border-light)] p-8 animate-fadeIn" style={{ animationDelay: '0.1s' }}>
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Customer Support</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-8">고객지원</p>

          <div className="space-y-6">
            <p className="text-base text-[var(--color-text-secondary)] leading-relaxed">
              매일일독 서비스 이용 중 궁금한 점이나 불편한 점이 있으시면 언제든지 문의해 주세요. 빠르게 답변 드리겠습니다.
            </p>

            <div className="space-y-4">
              <div className="flex items-center gap-4 p-4 bg-[var(--color-bg-tertiary)] rounded-[12px] border border-[var(--color-border-light)]">
                <div className="flex items-center justify-center w-12 h-12 bg-[var(--color-accent-primary)] text-white rounded-[12px] flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </div>
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider">Email</span>
                  <span className="text-base text-[var(--color-text-primary)] font-medium">support@maeil1dok.app</span>
                </div>
              </div>
            </div>

            <a 
              href="mailto:support@maeil1dok.app" 
              className="inline-flex items-center justify-center gap-2 w-full px-8 py-4 bg-[var(--color-accent-primary)] text-white rounded-[12px] font-semibold text-base hover:bg-[var(--color-accent-hover)] hover:shadow-lg hover:-translate-y-0.5 active:translate-y-0 transition-all"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              이메일 보내기
            </a>

            <div className="p-4 bg-[var(--color-bg-tertiary)] rounded-[12px] border-l-4 border-[var(--color-accent-primary)]">
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed m-0">
                <strong className="text-[var(--color-text-primary)]">운영 시간:</strong> 평일 09:00 - 18:00<br/>
                <small className="text-[var(--color-text-tertiary)]">주말 및 공휴일에는 답변이 지연될 수 있습니다.</small>
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center mt-6 animate-fadeIn" style={{ animationDelay: '0.2s' }}>
          <Link href="/company" className="px-5 py-2.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] rounded-full text-sm font-medium hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-dark)] transition-all">
            회사정보
          </Link>
          <Link href="/privacy" className="px-5 py-2.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] rounded-full text-sm font-medium hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-dark)] transition-all">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="px-5 py-2.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] rounded-full text-sm font-medium hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-dark)] transition-all">
            이용약관
          </Link>
          <Link href="/" className="px-5 py-2.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] rounded-full text-sm font-medium hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-dark)] transition-all">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  )
}
