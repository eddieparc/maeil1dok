export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-2xl mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-2">개인정보처리방침</h1>
        <p className="text-gray-600 mb-8">개인정보 처리방침</p>

        <div className="prose prose-sm max-w-none space-y-6">
          <p className="text-gray-700 pb-6 border-b border-gray-200">
            제이지피랩스(이하 "회사")는 개인정보 보호법에 따라 이용자의 개인정보 보호 및 권익을 보호하고 
            개인정보와 관련한 이용자의 고충을 원활하게 처리할 수 있도록 다음과 같은 처리방침을 두고 있습니다.
          </p>

          <section>
            <h2 className="text-xl font-semibold mb-3">1. 개인정보의 처리 목적</h2>
            <p className="text-gray-700 mb-3">
              회사는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 
              용도로는 이용되지 않으며, 이용 목적이 변경되는 경우에는 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>회원 가입 및 관리: 회원 가입의사 확인, 회원제 서비스 제공, 회원자격 유지·관리, 서비스 부정이용 방지</li>
              <li>성경통독 서비스: 성경 읽기 진행 상황 기록, 통독 현황 관리, 개인별 진도율 제공</li>
              <li>알림 서비스: 성경통독 리마인더, 서비스 관련 공지사항 전달</li>
              <li>마케팅 및 광고: 이벤트 및 광고성 정보 제공, 서비스 이용 통계</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">2. 수집하는 개인정보 항목</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>필수항목:</strong> 이메일 주소, 이름, 소셜 로그인 식별자</li>
              <li><strong>선택항목:</strong> 프로필 이미지, 닉네임</li>
              <li><strong>자동수집항목:</strong> IP 주소, 쿠키, 서비스 이용 기록, 접속 로그, 기기 정보</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">3. 개인정보의 보유 및 이용기간</h2>
            <p className="text-gray-700 mb-3">
              회사는 법령에 따른 개인정보 보유·이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 
              개인정보 보유·이용기간 내에서 개인정보를 처리·보유합니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>회원 정보: 회원 탈퇴 시까지</li>
              <li>로그인 기록: 3개월 (통신비밀보호법)</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">4. 개인정보의 제3자 제공</h2>
            <p className="text-gray-700 mb-3">
              회사는 원칙적으로 이용자의 개인정보를 제3자에게 제공하지 않습니다. 다만, 아래의 경우에는 예외로 합니다.
            </p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>이용자가 사전에 동의한 경우</li>
              <li>법령의 규정에 의거하거나, 수사 목적으로 법령에 정해진 절차와 방법에 따라 수사기관의 요구가 있는 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">5. 개인정보의 파기</h2>
            <p className="text-gray-700">
              회사는 개인정보 보유기간의 경과, 처리목적 달성 등 개인정보가 불필요하게 되었을 때에는 지체없이 
              해당 개인정보를 파기합니다. 전자적 파일 형태의 정보는 복구 및 재생되지 않도록 안전하게 삭제하고, 
              그 밖의 기록물은 파쇄 또는 소각합니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">6. 정보주체의 권리·의무 및 행사방법</h2>
            <p className="text-gray-700 mb-3">이용자는 개인정보주체로서 다음과 같은 권리를 행사할 수 있습니다.</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>개인정보 열람 요구</li>
              <li>오류 등이 있을 경우 정정 요구</li>
              <li>삭제 요구</li>
              <li>처리정지 요구</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">7. 개인정보의 안전성 확보 조치</h2>
            <p className="text-gray-700 mb-3">회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>개인정보의 암호화</li>
              <li>해킹 등에 대비한 기술적 대책</li>
              <li>개인정보에 대한 접근 제한</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">8. 쿠키의 사용</h2>
            <p className="text-gray-700">
              회사는 이용자에게 개별적인 맞춤서비스를 제공하기 위해 이용정보를 저장하고 수시로 불러오는 
              '쿠키(cookie)'를 사용합니다. 이용자는 웹브라우저 설정을 통해 쿠키 저장을 거부할 수 있으나, 
              이 경우 서비스 이용에 어려움이 있을 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">9. 개인정보 보호책임자</h2>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li><strong>성명:</strong> 박지건</li>
              <li><strong>연락처:</strong> support@maeil1dok.app</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">10. 권익침해 구제방법</h2>
            <p className="text-gray-700 mb-3">개인정보침해에 대한 신고나 상담이 필요하신 경우 아래 기관에 문의하시기 바랍니다.</p>
            <ul className="list-disc list-inside space-y-2 text-gray-700">
              <li>개인정보침해신고센터: (국번없이) 118</li>
              <li>개인정보분쟁조정위원회: 1833-6972</li>
              <li>대검찰청 사이버수사과: (국번없이) 1301</li>
              <li>경찰청 사이버안전국: (국번없이) 182</li>
            </ul>
          </section>

          <section>
            <h2 className="text-xl font-semibold mb-3">11. 개인정보 처리방침 변경</h2>
            <p className="text-gray-700 mb-3">
              이 개인정보 처리방침은 시행일로부터 적용되며, 법령 및 방침에 따른 변경내용의 추가, 삭제 및 정정이 
              있는 경우에는 변경사항의 시행 7일 전부터 공지사항을 통하여 고지할 것입니다.
            </p>
            <p className="text-gray-700 pt-3 border-t border-dashed border-gray-300">
              <strong>시행일:</strong> 2025년 1월 1일
            </p>
          </section>
        </div>
      </div>
    </div>
  )
}
