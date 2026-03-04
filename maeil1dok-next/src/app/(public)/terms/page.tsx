'use client'

import PageHeader from '@/components/ui/PageHeader'
import Link from 'next/link'

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-[var(--color-bg-primary)]">
      <PageHeader title="이용약관" fallback-path="/" />

      <div className="max-w-[768px] mx-auto px-4 py-6">
        <div className="bg-[var(--color-bg-card)] rounded-[20px] shadow-[var(--shadow-md)] border border-[var(--color-border-light)] p-8">
          <h1 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">Terms of Service</h1>
          <p className="text-sm text-[var(--color-text-secondary)] mb-8">서비스 이용약관</p>

          <div className="space-y-6 text-sm leading-relaxed">
            <p className="text-[var(--color-text-secondary)] pb-6 border-b border-[var(--color-border-light)]">
              제이지피랩스(이하 "회사")가 제공하는 서비스를 이용해 주셔서 감사합니다. 
              본 약관은 회사가 제공하는 서비스의 이용조건 및 절차, 회사와 회원 간의 권리와 의무 등을 규정합니다.
            </p>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">제1조 (목적)</h2>
              <p className="text-[var(--color-text-secondary)]">
                본 약관은 제이지피랩스(이하 "회사")가 운영하는 웹사이트 및 모바일 애플리케이션(이하 "서비스")에서 
                제공하는 성경통독 관리, 진행 현황 기록 등 관련 서비스(이하 "서비스")의 이용조건 및 절차, 
                회사와 회원 간의 권리, 의무, 책임사항과 기타 필요한 사항을 규정함을 목적으로 합니다.
              </p>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">제2조 (정의)</h2>
              <ol className="list-decimal list-inside space-y-2 text-[var(--color-text-secondary)] pl-2">
                <li><strong className="text-[var(--color-text-primary)]">"서비스"</strong>란 회사가 제공하는 성경통독 진행 관리, 일일 성경읽기 기록, 하세나하시조 영상 시청, 성경개론 영상 시청 등 모든 서비스를 의미합니다.</li>
                <li><strong className="text-[var(--color-text-primary)]">"회원"</strong>이란 본 약관에 동의하고 회원가입을 통해 서비스를 이용하는 자를 말합니다.</li>
                <li><strong className="text-[var(--color-text-primary)]">"콘텐츠"</strong>란 회사 또는 회원이 서비스에 게시한 텍스트, 이미지, 동영상 등 모든 형태의 정보를 말합니다.</li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">제3조 (약관의 효력 및 변경)</h2>
              <ol className="list-decimal list-inside space-y-2 text-[var(--color-text-secondary)] pl-2">
                <li>본 약관은 서비스를 이용하고자 하는 모든 회원에게 적용됩니다.</li>
                <li>회사는 필요한 경우 관련 법령을 위배하지 않는 범위에서 본 약관을 변경할 수 있으며, 변경된 약관은 서비스 내 공지사항을 통해 공지합니다.</li>
                <li>회원이 변경된 약관에 동의하지 않는 경우 서비스 이용을 중단하고 탈퇴할 수 있으며, 변경된 약관의 효력 발생일 이후에도 서비스를 계속 이용하는 경우 약관 변경에 동의한 것으로 간주합니다.</li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">제4조 (회원가입 및 계정)</h2>
              <ol className="list-decimal list-inside space-y-2 text-[var(--color-text-secondary)] pl-2">
                <li>회원가입은 소셜 로그인(카카오, 구글 등) 또는 이메일을 통해 이루어지며, 가입 시 본 약관 및 개인정보처리방침에 동의해야 합니다.</li>
                <li>회원은 가입 시 정확한 정보를 제공해야 하며, 허위 정보로 인한 불이익은 회원이 부담합니다.</li>
                <li>회원은 자신의 계정 정보를 안전하게 관리할 책임이 있으며, 제3자에게 계정을 양도하거나 공유할 수 없습니다.</li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">제5조 (서비스의 제공)</h2>
              <p className="text-[var(--color-text-secondary)] mb-2">회사는 다음과 같은 서비스를 제공합니다:</p>
              <ul className="list-disc list-inside space-y-2 text-[var(--color-text-secondary)] pl-2">
                <li><strong className="text-[var(--color-text-primary)]">성경통독 관리:</strong> 일일 읽기 분량 안내, 진행 현황 기록</li>
                <li><strong className="text-[var(--color-text-primary)]">콘텐츠 제공:</strong> 하세나하시조 영상, 성경개론 영상, 오디오 성경 등 멀티미디어 콘텐츠</li>
                <li><strong className="text-[var(--color-text-primary)]">진도 관리:</strong> 개인별 성경통독 진도율 확인, 완독 현황 관리</li>
                <li><strong className="text-[var(--color-text-primary)]">알림 서비스:</strong> 성경읽기 리마인더, 서비스 관련 공지</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">제6조 (회원의 의무)</h2>
              <p className="text-[var(--color-text-secondary)] mb-2">회원은 다음 행위를 해서는 안 됩니다:</p>
              <ul className="list-disc list-inside space-y-2 text-[var(--color-text-secondary)] pl-2">
                <li>타인의 정보를 도용하거나 허위 정보를 등록하는 행위</li>
                <li>서비스 운영을 방해하거나 시스템에 부하를 주는 행위</li>
                <li>타인을 비방, 모욕하거나 명예를 훼손하는 콘텐츠 게시</li>
                <li>음란물, 불법 정보 등 법령에 위배되는 콘텐츠 게시</li>
                <li>저작권 등 타인의 지적재산권을 침해하는 행위</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">제7조 (서비스 이용제한)</h2>
              <p className="text-[var(--color-text-secondary)] mb-2">회사는 회원이 다음에 해당하는 경우 서비스 이용을 제한하거나 회원자격을 상실시킬 수 있습니다:</p>
              <ul className="list-disc list-inside space-y-2 text-[var(--color-text-secondary)] pl-2">
                <li>본 약관을 위반한 경우</li>
                <li>서비스 운영을 고의로 방해한 경우</li>
                <li>법령 또는 공서양속에 위배되는 행위를 한 경우</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">제8조 (회사의 면책)</h2>
              <ol className="list-decimal list-inside space-y-2 text-[var(--color-text-secondary)] pl-2">
                <li>회사는 천재지변, 전쟁, 테러, 해킹 등 불가항력적 사유로 서비스를 제공할 수 없는 경우 책임을 지지 않습니다.</li>
                <li>회사는 회원의 귀책사유로 인한 서비스 이용 장애에 대해 책임을 지지 않습니다.</li>
                <li>회사는 회원 간 또는 회원과 제3자 간의 분쟁에 대해 개입하지 않으며, 이로 인한 손해에 대해 책임을 지지 않습니다.</li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">제9조 (분쟁해결)</h2>
              <ol className="list-decimal list-inside space-y-2 text-[var(--color-text-secondary)] pl-2">
                <li>회사와 회원 간 발생한 분쟁에 대해서는 상호 협의하여 해결합니다.</li>
                <li>협의가 이루어지지 않을 경우, 관할법원은 회사 소재지 관할 법원으로 합니다.</li>
              </ol>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">제10조 (고객센터)</h2>
              <p className="text-[var(--color-text-secondary)] mb-2">서비스 이용 관련 문의는 아래 연락처로 문의해 주세요:</p>
              <ul className="list-disc list-inside space-y-2 text-[var(--color-text-secondary)] pl-2">
                <li><strong className="text-[var(--color-text-primary)]">이메일:</strong> support@maeil1dok.app</li>
              </ul>
            </section>

            <section className="space-y-3">
              <h2 className="text-base font-semibold text-[var(--color-text-primary)]">부칙</h2>
              <p className="text-[var(--color-text-secondary)] pt-4 border-t border-dashed border-[var(--color-border-default)]">
                본 약관은 2025년 1월 1일부터 시행합니다.
              </p>
            </section>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 justify-center mt-6">
          <Link href="/privacy" className="px-5 py-2.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] rounded-full text-sm font-medium hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-dark)] transition-all">
            개인정보처리방침
          </Link>
          <Link href="/company" className="px-5 py-2.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] rounded-full text-sm font-medium hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-dark)] transition-all">
            회사정보
          </Link>
          <Link href="/" className="px-5 py-2.5 bg-[var(--color-bg-tertiary)] text-[var(--color-text-secondary)] border border-[var(--color-border-default)] rounded-full text-sm font-medium hover:bg-[var(--color-bg-hover)] hover:text-[var(--color-text-primary)] hover:border-[var(--color-border-dark)] transition-all">
            홈으로
          </Link>
        </div>
      </div>
    </div>
  )
}
