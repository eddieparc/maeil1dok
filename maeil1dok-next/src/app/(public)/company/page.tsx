export default function CompanyPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">회사정보</h1>
        <p className="text-[var(--color-text-secondary)] mb-8">회사정보</p>

        <div className="space-y-6">
          <div className="space-y-4">
            <div className="pb-4 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Company Name</p>
              <p className="text-lg text-[var(--color-text-primary)]">제이지피랩스</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Representative</p>
              <p className="text-lg text-[var(--color-text-primary)]">박지건</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Business Registration No.</p>
              <p className="text-lg text-[var(--color-text-primary)]">613-24-62749</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Mail-Order Sales No.</p>
              <p className="text-lg text-[var(--color-text-primary)]">제 2022-용인기흥-1517 호</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Address</p>
              <p className="text-lg text-[var(--color-text-primary)]">경기도 용인시 기흥구 동백4로 6, 6105호</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Phone</p>
              <p className="text-lg text-[var(--color-text-primary)]">010-2368-9677</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Email</p>
              <p className="text-lg text-[var(--color-text-primary)]">support@maeil1dok.app</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Privacy Officer</p>
              <p className="text-lg text-[var(--color-text-primary)]">박지건</p>
            </div>

            <div className="pb-4 border-b border-[var(--color-border)]">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Business Verification</p>
              <p className="text-lg text-[var(--color-text-primary)]">
                <a 
                  href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=6132462749" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-blue-600 hover:text-blue-800 underline"
                >
                  사업자정보확인 →
                </a>
              </p>
            </div>

            <div className="pb-4">
              <p className="text-xs font-semibold text-[var(--color-text-secondary)] uppercase tracking-wider mb-1">Hosting Provider</p>
              <p className="text-lg text-[var(--color-text-primary)]">Vercel Inc.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
