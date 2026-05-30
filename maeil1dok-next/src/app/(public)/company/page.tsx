'use client'

import PageHeader from '@/components/ui/PageHeader'
import Link from 'next/link'

export default function CompanyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <PageHeader title="회사정보" fallback-path="/" />

      <div className="max-w-[768px] mx-auto px-4 py-6">
        <div className="bg-[var(--color-bg-card)] rounded-[20px] shadow-[var(--shadow-md)] border border-[var(--color-border-light)] p-8">
          <h1
            className="text-[28px] font-medium text-[var(--color-ink)] -tracking-[0.03em] leading-[1.2] mb-1"
            style={{ fontFamily: 'var(--font-family-serif)' }}
          >
            Company Info
          </h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-8">회사정보</p>

          <div className="space-y-4">
            <div className="pb-4 border-b border-[var(--color-border-light)]">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Company Name</p>
              <p className="text-base text-[var(--color-text-primary)]">제이지피랩스</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border-light)]">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Representative</p>
              <p className="text-base text-[var(--color-text-primary)]">박지건</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border-light)]">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Business Registration No.</p>
              <p className="text-base text-[var(--color-text-primary)]">613-24-62749</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border-light)]">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Mail-Order Sales No.</p>
              <p className="text-base text-[var(--color-text-primary)]">제 2022-용인기흥-1517 호</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border-light)]">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Address</p>
              <p className="text-base text-[var(--color-text-primary)]">경기도 용인시 기흥구 동백4로 6, 6105호</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border-light)]">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Phone</p>
              <p className="text-base text-[var(--color-text-primary)]">010-2368-9677</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border-light)]">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Email</p>
              <p className="text-base text-[var(--color-text-primary)]">support@maeil1dok.app</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border-light)]">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Privacy Officer</p>
              <p className="text-base text-[var(--color-text-primary)]">박지건</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border-light)]">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Business Verification</p>
              <p className="text-base text-[var(--color-text-primary)]">
                <a 
                  href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=6132462749" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[var(--color-brand)] hover:opacity-80 transition-opacity"
                >
                  사업자정보확인 →
                </a>
              </p>
            </div>

            <div className="pb-4">
              <p className="text-xs font-semibold text-[var(--color-text-tertiary)] uppercase tracking-wider mb-1">Hosting Provider</p>
              <p className="text-base text-[var(--color-text-primary)]">Vercel Inc.</p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-2 justify-center mt-6" style={{ fontFamily: 'var(--font-family-ui)' }}>
          <Link href="/privacy" className="px-4 py-2 bg-transparent text-[var(--color-mute)] border border-[var(--color-rule)] rounded-full text-[12px] font-semibold -tracking-[0.005em] hover:bg-[var(--color-brand-faint)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors">
            개인정보처리방침
          </Link>
          <Link href="/terms" className="px-4 py-2 bg-transparent text-[var(--color-mute)] border border-[var(--color-rule)] rounded-full text-[12px] font-semibold -tracking-[0.005em] hover:bg-[var(--color-brand-faint)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors">
            이용약관
          </Link>
          <Link href="/" className="px-4 py-2 bg-transparent text-[var(--color-mute)] border border-[var(--color-rule)] rounded-full text-[12px] font-semibold -tracking-[0.005em] hover:bg-[var(--color-brand-faint)] hover:text-[var(--color-ink)] hover:border-[var(--color-ink)] transition-colors">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  )
}
