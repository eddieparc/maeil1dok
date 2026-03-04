'use client'

import PageHeader from '@/components/ui/PageHeader'
import Link from 'next/link'

export default function CompanyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <PageHeader title="회사정보" fallback-path="/" />

      <div className="max-w-[768px] mx-auto px-4 py-6">
        <div className="bg-[var(--color-bg-card)] rounded-[20px] shadow-[var(--shadow-md)] border border-[var(--color-border-light)] p-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Company Info</h1>
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
                  className="text-[var(--color-accent-primary)] hover:opacity-80 transition-opacity"
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

        <div className="flex flex-wrap gap-3 justify-center mt-6">
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
