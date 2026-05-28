# 04 · 프로덕션 라이브 실측 (제약 환경)

> **작성자**: Sisyphus (sub-agent 크레딧 부족으로 본 세션 직접 수행)  
> **도구**: Webfetch (정적 HTML/텍스트 캡처만 가능. JS 실행/콘솔/네트워크 추적 불가)  
> **타겟**: https://maeil1dok.app  
> **검증일**: 2026-05-28  
> **중요 제약**: Playwright 미사용으로 인해 다음은 본 문서에서 검증 불가:  
> - 콘솔 에러 (BUG-003)  
> - JS 인터랙션 결과 (BUG-001/004 의 핵심 부분 — iframe 안 본문, 책장 선택 후 URL)  
> - 네트워크 401/404 추적  
> - 다크모드 토글 동작  
> - 모바일 vs 데스크탑 시각 차이  
> 위 항목들은 Gate A 통과 검증 직전 Playwright 재시도 필요 (배경 agent 크레딧 복구 후, 또는 본 세션의 직접 playwright 실행).

---

## 1. 도달 페이지 (Webfetch 기반)

| URL | 도달 성공 | 페이지 제목 | 비고 |
|---|---|---|---|
| https://maeil1dok.app/ | ✅ | "매일일독" | 비로그인 홈. "방문자님, 환영합니다", "평안한 밤, 말씀과 동행하세요" + 카드 grid (개론영상/하세나/커뮤니티/내활동) |
| https://maeil1dok.app/bible | ✅ (HTML) | "창세기 1장 \| 매일일독" | 본문 텍스트 영역이 webfetch 텍스트로는 **"창세기 1장창 1장창세기 1장" 만 보임**. 실제 본문 verses 가 webfetch 결과에 없음 → **iframe 또는 클라이언트 렌더링 추정 (BUG-001 재현 가능성 — Playwright로 재검증 필수)** |
| https://maeil1dok.app/scoreboard | ✅ | "리더보드" | 필터 (전체/이번달/이번주, 전체/친구/팔로잉), "리더보드 데이터가 없습니다" (비로그인이라 빈 상태) |
| https://maeil1dok.app/login | ✅ | "로그인 - 매일일독" | 카카오/구글/Apple 진입 + 이메일/비밀번호 + 비밀번호 찾기 + 이메일 회원가입 + 이용약관/개인정보/사업자 정보 푸터 |

---

## 2. 핵심 관찰 — Webfetch 한계 내에서

### 2.1 홈 (/) — 정상 렌더
- 카드 4개 (개론 영상, 하세나하시조, 커뮤니티, 내 활동) 표시
- 내 활동 카드는 비로그인이라 `/login` 으로 연결됨
- 하단 네비 (홈 / 성경 / 프로필) 노출. 프로필은 비로그인 시 /login

### 2.2 /bible — 본문 표시 부족 (검증 필요)
- Webfetch 텍스트 출력에는 **본문 verses 가 없음** ("창세기 1장" 헤딩만 반복).
- 두 가지 해석:
  1. iframe 안에 본문이 있어 webfetch 가 못 가져옴 (정상 동작)
  2. 본문이 실제로 표시 안 되고 있음 (BUG-001 재현)
- **즉시 결론 보류**. Playwright 로 iframe 안쪽 텍스트 확인 필요.

### 2.3 /scoreboard — UI 정상
- 필터 UI 노출됨
- 비로그인이라 데이터 빈 상태 — 정상

### 2.4 /login — UI 정상
- 4가지 진입 방법 모두 노출
- 비밀번호 찾기, 이메일 회원가입 링크 정상

### 2.5 다크모드
- Webfetch 단독으로는 토글 동작 확인 불가
- 06 quality-scorecard 의 다크모드 행은 Playwright 실측으로 채워야 함

---

## 3. 핵심 직전 버그 재현 시도 (제한된 답)

| 버그 | 직전 증상 | Webfetch 결과 | 재현 단정? |
|---|---|---|---|
| BUG-001: /bible 본문 미표시 | 본문 텍스트 자체 없음 | Webfetch 텍스트에 본문 absent | **단정 불가** (iframe 가능성). Playwright 필요. |
| BUG-002: btn_listen.png 404 | 듣기 아이콘 404 | 정적 fetch 미수행 | 단정 불가 |
| BUG-003: 콘솔 에러 다수 | 콘솔 에러 (401, 400, 404) | webfetch 는 콘솔 못 봄 | 단정 불가 |
| BUG-004: 책장 선택 URL undefined | 책 선택 → URL `?chapter=undefined` | 인터랙션 미수행 | 단정 불가 |
| BUG-005: "Task 3-3 구현 예정" 노출 | /bible/highlights 의 placeholder | 비로그인 → /login 으로 |  비로그인 접근 불가, 단정 불가 |
| T0004: 리더보드 뒤로가기 500 | 간헐 SSR hydration 실패 | 한 번 만 webfetch | 단정 불가 |

---

## 4. 발견한 의외 사항

1. **모바일·데스크탑 구분 없이 동일 콘텐츠** (Webfetch는 단일 viewport 가정). 반응형 검증 불가.
2. **현재 운영 사이트가 maeil1dok.app 단일 도메인** — Plan F 의 컷오버 대상과 일치.
3. **카드 grid 의 "내 활동" 만 /login** 으로 가는 패턴 — 비로그인 사용자 진입을 의도적으로 막는 마케팅 흐름으로 추정 (검증 필요).

---

## 5. 미해결 (다음 단계 필수)

Gate A 통과 검증을 위해 **다음을 본 세션이 직접 Playwright 로 수행** 필요:

| # | 항목 | 명령 |
|---|---|---|
| L-1 | /bible 에서 창세기 1장 본문 텍스트 실 표시 검증 | `iframe.contentDocument.body.innerText` 추출 |
| L-2 | 책장 선택 → URL 변화 추적 | playwright `page.waitForURL` |
| L-3 | 콘솔 에러 (`console.error`) 수집 | `page.on('console')` |
| L-4 | 네트워크 4xx/5xx 수집 | `page.on('response')` |
| L-5 | 다크모드 토글 동작 + 페이지별 반영 | 토글 클릭 → 스크린샷 비교 |
| L-6 | 모바일 (375px) + 데스크탑 (1280px) VRT | viewport 변경 + 스크린샷 |
| L-7 | /bible/highlights 비로그인 시 동작 (placeholder 노출 여부 — 비로그인 접근 불가하면 N/A) | 동작 확인 |

→ 본 세션이 직접 Playwright 를 호출 (`mcp_Playwright` 시리즈) 하여 위 7개를 채울 수 있음. Gate A 통과 직전 1회 수행.

---

## 6. 자가 검증 (Webfetch 한계 명시)

- ✅ 4개 라우트 정적 HTML/텍스트 캡처 성공
- ✅ 비로그인 진입 흐름 (`/` → `/login`) 확인
- ⚠️ 본문 렌더링 검증 (BUG-001) — 단정 불가, Playwright 필요
- ⚠️ 인터랙션 (BUG-004), 콘솔 (BUG-003), 네트워크 (BUG-002, T0004) — 모두 미검증
- ⚠️ 다크모드, 모바일/데스크탑 비교 — 미검증

본 문서는 Webfetch 한계 내에서의 **최대치**이며, Gate A 통과 전 위 §5 의 L-1 ~ L-7 보강이 의무.

<!-- production-fetch-date: 2026-05-28 -->
