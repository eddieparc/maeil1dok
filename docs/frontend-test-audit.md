# Frontend `assert.match` test audit

## 결론

`frontend/tests/*.test.mjs`의 `assert.match` 호출 지점 288개를 전수 검토했다. 분류 결과는 **DELETE 89 / UNIT 83 / DOM 87 / KEEP 29**이며, 이번 변경에서는 DELETE 89개만 제거했다. 테스트 케이스 자체는 제거하지 않았다.

이 문서의 개수 기준은 감사 시작 시점의 정적 호출 지점(`rg "assert\.match" frontend/tests`)이다. 반복문 안의 호출과 `assertContract` 같은 래퍼 내부 호출도 코드에 적힌 호출 지점 하나로 센다. 원본 행 번호는 제거 전 기준이다.

### 판정 근거 코드

- **D1 (DELETE)**: CSS 철자, import/변수/함수명, 내부 호출/배선 등 구현 표기만 고정한다. 같은 동작을 다른 구현으로 만들면 깨지고 실제 동작은 증명하지 못한다.
- **U1 (UNIT)**: 이미 실제 값을 실행해 검사하거나, 기존 모듈을 직접 import/transform하면 DOM 없이 입출력을 검사할 수 있다.
- **U2 (UNIT)**: 의미 있는 결정/변환 로직이 컴포넌트나 콜백 안에 묻혀 있다. 순수 함수로 추출해 입출력을 검사해야 한다.
- **M1 (DOM)**: 렌더 결과, 조건부 표시, 접근성 이름, 클릭/키 입력, 이벤트 전달을 마운트한 컴포넌트에서 검사해야 한다.
- **M2 (DOM)**: 실제 레이아웃, 포커스/스크롤, 브라우저 또는 Service Worker 런타임이 필요하다.
- **K1 (KEEP)**: 프레임워크/브라우저/네이티브 런타임이 직접 소비하는 정확한 문자열 또는 설정값이다.
- **K2 (KEEP)**: 민감정보가 흐르는 로그 sink 전부를 정적으로 감사하는 보안 단언이다. 실행 테스트만으로 모든 sink에서 위험 호출의 부재를 증명하기 어렵고, 같은 케이스의 `doesNotMatch` 부재 검사와 짝을 이룬다.

## 집계

| 파일 | 원본 | DELETE | UNIT | DOM | KEEP | 실제 제거 |
|---|---:|---:|---:|---:|---:|---:|
| `account-settings-contract.test.mjs` | 38 | 11 | 13 | 13 | 1 | 11 |
| `app-startup-performance.test.mjs` | 10 | 3 | 1 | 0 | 6 | 3 |
| `auth-session-safety.test.mjs` | 39 | 5 | 25 | 0 | 9 | 5 |
| `bible-cache-search-ui.test.mjs` | 13 | 1 | 6 | 6 | 0 | 1 |
| `bible-fetch-cache-priority.test.mjs` | 2 | 0 | 2 | 0 | 0 | 0 |
| `bible-search.test.mjs` | 9 | 3 | 0 | 6 | 0 | 3 |
| `bible-selection-toolbar.test.mjs` | 25 | 9 | 3 | 13 | 0 | 9 |
| `date-format-local-timezone.test.mjs` | 1 | 0 | 1 | 0 | 0 | 0 |
| `hasena-completion-button.test.mjs` | 2 | 0 | 0 | 2 | 0 | 0 |
| `hasena-formatters.test.mjs` | 9 | 0 | 9 | 0 | 0 | 0 |
| `hasena-tooltip-style.test.mjs` | 2 | 2 | 0 | 0 | 0 | 2 |
| `hasena-video-embed-url.test.mjs` | 3 | 2 | 0 | 1 | 0 | 2 |
| `landing-navigation.test.mjs` | 48 | 20 | 3 | 17 | 8 | 20 |
| `landing-shell-performance.test.mjs` | 4 | 4 | 0 | 0 | 0 | 4 |
| `notifications-contract.test.mjs` | 30 | 10 | 1 | 14 | 5 | 10 |
| `page-layout-contract.test.mjs` | 6 | 4 | 0 | 2 | 0 | 4 |
| `profile-achievements-ux.test.mjs` | 1 | 0 | 0 | 1 | 0 | 0 |
| `reading-position.test.mjs` | 24 | 7 | 13 | 4 | 0 | 7 |
| `scoreboard-hasena-activity.test.mjs` | 8 | 4 | 0 | 4 | 0 | 4 |
| `scoreboard-ux-contract.test.mjs` | 1 | 0 | 0 | 1 | 0 | 0 |
| `sns-certification-contract.test.mjs` | 1 | 0 | 0 | 1 | 0 | 0 |
| `sns-certification-share-runtime.test.mjs` | 5 | 0 | 5 | 0 | 0 | 0 |
| `tongdok-audio-speed.test.mjs` | 7 | 4 | 1 | 2 | 0 | 4 |
| **합계** | **288** | **89** | **83** | **87** | **29** | **89** |

## 단언별 분류

### `account-settings-contract.test.mjs` (38)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| A01 (L82) | `interface ${typeName}` | 세 interface의 선언 이름 | DELETE | D1: 타입 이름/선언 방식은 typecheck 대상이다. |
| A02 (L101) | `password: deletePassword.value` | 삭제 payload의 비밀번호 값 | UNIT | U2: `buildDeleteAccountPayload` 입출력으로 검사한다. |
| A03 (L102) | `confirm_delete: true` | 삭제 확인 sentinel | UNIT | U2: 삭제 payload builder의 기계 소비 값이다. |
| A04 (L103) | `!has_password` 분기 | 비밀번호 없는 계정의 삭제 흐름 | DOM | M1: 계정 상태별 폼/확인 UI를 렌더해야 한다. |
| A05 (L104) | 빈 `deletePassword` 분기 | 필수 비밀번호 검증 UX | DOM | M1: 제출 후 오류/요청 부재를 검사해야 한다. |
| A06 (L109) | `modal.confirm` | 확인 모달 호출 | DOM | M1: 삭제 액션이 실제 confirm을 여는지 검사한다. |
| A07 (L110) | `modal.alert` | 알림 모달 호출 | DOM | M1: 실패 상태의 실제 alert 표시를 검사한다. |
| A08 (L114) | `PROVIDERS` 배열 | kakao/google/apple 제공자 집합 | DOM | M1: 세 제공자 액션의 렌더 결과가 계약이다. |
| A09 (L115) | `v-for="provider..."` | 반복문 문법 | DELETE | D1: 세 액션을 어떤 문법으로 만드는지는 무관하다. |
| A10 (L116) | `handleLinkProvider(provider)` | 내부 클릭 핸들러 철자 | DELETE | D1: 클릭 결과 없이 내부 함수명만 본다. |
| A11 (L125) | 제공자 라벨 | 카카오/Google/Apple 표시 | DOM | M1: 사용자에게 보이는 라벨을 질의한다. |
| A12 (L128) | `getProviderDisplayName` 호출 | 내부 formatter 이름 | DELETE | D1: 표시 결과가 아닌 호출 철자다. |
| A13 (L130) | 제공자별 label map | provider-to-label 매핑 | UNIT | U2: 순수 `getProviderDisplayName`으로 추출한다. |
| A14 (L139) | link-state API 경로 | `/api/v1/auth/oauth/link-state/` | KEEP | K1: 백엔드 라우터가 소비하는 정확한 endpoint이며 helper 이름 변화는 허용한다. |
| A15 (L140) | state URL encoding | OAuth URL의 state 보존/인코딩 | UNIT | U1: 기존 `buildOAuthLinkUrl` 결과 URL로 검사 가능하다. |
| A16 (L143) | route state 첫 값 선택 | callback query 정규화 | UNIT | U2: callback input parser로 추출한다. |
| A17 (L144) | signed link-state 판별 | 서명 state 형식 검증 | UNIT | U2: `isSignedLinkState`를 직접 검사한다. |
| A18 (L145) | regex `.test(state)` | 검증 구현의 호출 철자 | DELETE | D1: A17의 결과만 계약이고 정규식 사용은 아니다. |
| A19 (L147) | `{ provider, code, state }` | callback API payload | UNIT | U2: callback payload builder 입출력으로 검사한다. |
| A20 (L151) | client scheme allowlist | 허용 앱 scheme 두 개 | UNIT | U2: redirect scheme validator의 허용/거부 표로 검사한다. |
| A21 (L152) | `getSafeAppScheme` 사용 | 비신뢰 scheme 필터링 | UNIT | U2: validator를 직접 호출한다. |
| A22 (L153) | app-origin + safe scheme | native redirect 결정 | UNIT | U2: 순수 redirect decision으로 추출한다. |
| A23 (L159) | server scheme allowlist | 두 서버 경로의 동일 allowlist | UNIT | U2: client/server 공용 validator로 통합한다. |
| A24 (L160) | server safe scheme 호출 | 서버 redirect scheme 필터링 | UNIT | U2: 공용 validator의 입력/출력을 검사한다. |
| A25 (L166) | `linkingProvider` ref 타입 | 로딩 상태 변수명/타입 | DELETE | D1: 렌더된 disabled/loading 상태가 계약이다. |
| A26 (L167) | Google handler 호출 | 내부 함수 호출 철자 | DELETE | D1: Google 버튼 클릭 결과를 증명하지 않는다. |
| A27 (L168) | OAuth config 누락 분기 | 설정 오류 처리 | DOM | M1: 누락 설정에서 오류 표시와 이동 부재를 검사한다. |
| A28 (L169) | provider 로딩 대입 | 링크 진행 상태 | DOM | M1: 버튼의 loading/disabled 상태를 렌더한다. |
| A29 (L170) | URL builder 호출 | 내부 helper 배선 | DELETE | D1: URL 결과 테스트가 대신해야 한다. |
| A30 (L171) | `location.assign` | OAuth provider 이동 | DOM | M1: 클릭 후 navigation adapter 호출을 관찰한다. |
| A31 (L212) | 설정 섹션 라벨 | 이메일/병합/알림 섹션 표시 | DOM | M1: 렌더 텍스트 계약이다. |
| A32 (L242) | `merge_token` 파싱 | 백엔드 발급 merge token 보존 | UNIT | U2: callback error parser 입출력으로 검사한다. |
| A33 (L243) | merge helper 호출 | 내부 함수 호출 철자 | DELETE | D1: 바로 위 payload 결과 테스트와 중복이다. |
| A34 (L247) | `프로필 편집` | 본인 프로필 액션 표시 | DOM | M1: 본인/타인 조건부 렌더를 검사한다. |
| A35 (L248) | `계정 설정` | 계정 설정 액션 표시 | DOM | M1: 사용자에게 보이는 링크다. |
| A36 (L249) | handler 이름 in template | 내부 메서드명 | DELETE | D1: 클릭 결과가 아닌 이름만 고정한다. |
| A37 (L250) | handler 선언 이름 | 내부 함수 선언 철자 | DELETE | D1: 리팩터링에 취약한 중복 단언이다. |
| A38 (L251) | `/account/settings` 이동 | 클릭 목적지 | DOM | M1: 링크/클릭 후 route를 검사한다. |

### `app-startup-performance.test.mjs` (10)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| P01 (L51) | `parallel: true` | Nuxt client plugin 병렬 실행 설정 | KEEP | K1: Nuxt가 직접 소비하는 plugin metadata다. |
| P02 (L52) | `void auth.initialize()` | background 호출 철자 | DELETE | D1: non-blocking 결과가 아니라 `void` 표기만 본다. |
| P03 (L54) | `void settings.initialize()` | settings 호출 철자 | DELETE | D1: hydration 지연을 측정하지 않는다. |
| P04 (L61) | cached-user 삼항 분기 | 초기 auth fetch 전략 | UNIT | U2: 캐시 유무별 fetch policy를 순수 결정으로 분리한다. |
| P05 (L69) | `readCachedAuthUser()` 호출 | 내부 helper 배선 | DELETE | D1: 첫 화면 사용자 결과로 검증해야 한다. |
| P06 (L73) | `cacheEnabled={true}` | WebView HTTP cache 설정 | KEEP | K1: React Native WebView가 직접 소비하는 prop 값이다. |
| P07 (L74) | `LOAD_DEFAULT` | Android WebView cache mode | KEEP | K1: 네이티브 WebView가 소비하는 enum 문자열이다. |
| P08 (L75) | `hardware` layer | Android compositing mode | KEEP | K1: 네이티브 런타임 설정값이다. |
| P09 (L76) | `normal` deceleration | iOS scroll 감속 설정 | KEEP | K1: WebView가 소비하는 enum 문자열이다. |
| P10 (L77) | pull-to-refresh false | native pull-to-refresh 설정 | KEEP | K1: WebView가 직접 소비하는 boolean prop다. |

### `auth-session-safety.test.mjs` (39)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| S01 (L74) | silent refresh option | 초기 probe의 logout 방지 | UNIT | U2: auth refresh policy를 의존성 주입으로 실행한다. |
| S02 (L79) | conditional logout | 명시적 실패 때만 logout | UNIT | U2: 실패 정책의 호출 결과를 mock으로 검사한다. |
| S03 (L84) | revalidate logout option | 재검증의 강제 logout 정책 | UNIT | U2: revalidate policy를 직접 실행한다. |
| S04 (L92) | sensitive-key set | mobile 민감 query key 정책 | UNIT | U1: 기존 `mobile/urlRedaction.ts`를 transform/import한다. |
| S05 (L93) | query key 순회 | 모든 query parameter 처리 | UNIT | U1: 여러 key 조합의 출력으로 검사한다. |
| S06 (L94) | lowercase lookup | key 대소문자 무시 | UNIT | U1: mixed-case 입력 결과로 검사한다. |
| S07 (L95) | `[redacted]` 치환 | 민감 값 마스킹 | UNIT | U1: 실제 URL 출력으로 검사한다. |
| S08 (L106) | 8개 sensitive key | access/code/token alias 정책 | UNIT | U1: 각 key의 table-driven 실행 테스트로 바꾼다. |
| S09 (L109) | redactor import 문 | import 철자 | DELETE | D1: 공유 helper import만으로 sink 안전을 증명하지 않는다. |
| S10 (L121) | NavigationState sink | navState URL redaction | KEEP | K2: token-bearing 로그 sink의 정적 안전 감사다. |
| S11 (L122) | ShouldStartLoad sink | request URL redaction | KEEP | K2: 모든 navigation 요청의 로그 sink를 고정한다. |
| S12 (L123) | LoadEnd sink | load-end URL redaction | KEEP | K2: 실행 경로 누락을 정적으로 막는다. |
| S13 (L124) | error URL sink | WebView error URL redaction | KEEP | K2: 오류 경로의 raw URL 부재 검사와 짝이다. |
| S14 (L125) | YouTube-open sink | 외부 앱 URL redaction | KEEP | K2: 외부 navigation 로그의 비밀 유출 방지다. |
| S15 (L145) | Apple response log text | 비민감 로그 문구 | DELETE | D1: 로그 문구 존재는 안전성/동작 계약이 아니다. |
| S16 (L155) | relative signup token mask | signup token 실제 마스킹 | UNIT | U1: 실행 결과를 검사하고 있다. |
| S17 (L156) | relative safe param | 비민감 query 보존 | UNIT | U1: 실행 결과 계약이다. |
| S18 (L162) | absolute host/path | URL 구조 보존 | UNIT | U1: 실행 결과 계약이다. |
| S19 (L166) | absolute safe param | 비민감 query 보존 | UNIT | U1: 실행 결과 계약이다. |
| S20 (L178) | malformed fallback marker | malformed URL 마스킹 | UNIT | U1: fallback 출력 계약이다. |
| S21 (L186) | text redaction marker | 오류 문장 속 token 마스킹 | UNIT | U1: 실행 결과 계약이다. |
| S22 (L201) | access_token marker | alias 치환 결과 | UNIT | U1: 실행 결과 계약이다. |
| S23 (L202) | refresh_token marker | alias 치환 결과 | UNIT | U1: 실행 결과 계약이다. |
| S24 (L203) | id_token marker | alias 치환 결과 | UNIT | U1: 실행 결과 계약이다. |
| S25 (L204) | alias URL safe param | 비민감 값 보존 | UNIT | U1: 실행 결과 계약이다. |
| S26 (L212) | mixed-case safe param | 대소문자 입력의 안전 값 보존 | UNIT | U1: 실행 결과 계약이다. |
| S27 (L221) | hash token marker | fragment token 마스킹 | UNIT | U1: 실행 결과 계약이다. |
| S28 (L222) | hash safe param | fragment 안전 값 보존 | UNIT | U1: 실행 결과 계약이다. |
| S29 (L227) | relative hash safe param | 상대 URL fragment 보존 | UNIT | U1: 실행 결과 계약이다. |
| S30 (L236) | malformed alias marker | fallback alias 마스킹 | UNIT | U1: 실행 결과 계약이다. |
| S31 (L237) | malformed safe param | fallback 안전 값 보존 | UNIT | U1: 실행 결과 계약이다. |
| S32 (L242) | text alias marker | 문장 속 alias 마스킹 | UNIT | U1: 실행 결과 계약이다. |
| S33 (L246) | SSR request URL sink | Nitro error-hook URL redaction | KEEP | K2: raw request URL 부재를 정적으로 감사한다. |
| S34 (L247) | SSR request log sink | request hook URL redaction | KEEP | K2: 별도 hook의 raw URL 부재를 보장한다. |
| S35 (L248) | error message sink | 오류 message redaction | KEEP | K2: 예외 로그의 token 노출 경로다. |
| S36 (L249) | error stack sink | stack redaction | KEEP | K2: stack에 포함된 URL 비밀 노출을 막는다. |
| S37 (L253) | logger alias literals | 구현 내부 key 선언 철자 | DELETE | D1: S22-S24 실행 테스트가 실제 정책을 이미 검증한다. |
| S38 (L255) | `.toLowerCase()` | case-fold 구현 철자 | DELETE | D1: mixed-case 실행 결과로 검증해야 한다. |
| S39 (L256) | hash helper 대입 | fragment 처리 구현 철자 | DELETE | D1: S27-S29 실행 결과와 중복이다. |

### `bible-cache-search-ui.test.mjs` (13)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| C01 (L26) | `decodeHtmlEntities` | snippet entity decode | UNIT | U2: snippet formatter로 추출한다. |
| C02 (L27) | `sanitizeSnippet` | cache/source noise 제거 | UNIT | U2: 입력 HTML과 정리된 text를 직접 비교한다. |
| C03 (L28) | `highlightSnippet` 호출 | 검색어 강조 HTML 생성 | UNIT | U2: query를 인자로 받는 순수 함수로 추출한다. |
| C04 (L29) | `search-hit` class | 강조 결과 렌더 | DOM | M1: 결과 안의 강조 요소를 role/text로 질의한다. |
| C05 (L33) | input ref 이름 | 내부 ref 철자 | DELETE | D1: 실제 포커스 결과를 증명하지 않는다. |
| C06 (L34) | slash key 분기 | `/` 단축키 처리 | DOM | M1: keydown 후 input focus를 검사한다. |
| C07 (L35) | `.focus()` 호출 | 검색 input 포커스 | DOM | M1: `document.activeElement`가 계약이다. |
| C08 (L39) | result verse query | 검색 결과 deep-link verse | UNIT | U2: result-to-route builder로 추출한다. |
| C09 (L40) | result search query | 검색어 deep-link 보존 | UNIT | U2: route builder 출력으로 검사한다. |
| C10 (L44) | search query parser | 진입 query 정규화 | UNIT | U2: `parseSearchFocusParam`을 utility로 옮긴다. |
| C11 (L45) | reader forwarding | 검색어 focus 전달 | DOM | M1: component ref/event 경계를 실행한다. |
| C12 (L46) | viewer focus call | 절 안 검색어 focus | DOM | M1: 실제 강조/포커스 결과를 검사한다. |
| C13 (L47) | focused-term class | focused search term 표시 | DOM | M1: 렌더된 해당 단어를 질의한다. |

### `bible-fetch-cache-priority.test.mjs` (2)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| F01 (L37) | standard cache wrapper call | 표준 역본 cache-first 흐름 | UNIT | U2: fetch를 주입해 호출 순서/결과를 검사한다. |
| F02 (L51) | KNT cache wrapper call | KNT cache-first 흐름 | UNIT | U2: 같은 fallback 함수의 KNT 입력을 실행한다. |

### `bible-search.test.mjs` (9)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| B01 (L90) | submit button class | CSS/test selector 철자 | DELETE | D1: 버튼 존재/동작과 무관한 class다. |
| B02 (L91) | click handler attribute | 모바일 submit 클릭 | DOM | M1: click 후 같은 navigation 결과를 검사한다. |
| B03 (L92) | submit aria-label | 숫자 키보드 버튼 접근성 | DOM | M1: accessible name으로 버튼을 질의한다. |
| B04 (L101) | `/bible/search` link | 검색 버튼 목적지 | DOM | M1: 렌더 href 또는 클릭 route를 검사한다. |
| B05 (L102) | search aria-label | 검색 버튼 접근성 이름 | DOM | M1: role/name 질의 대상이다. |
| B06 (L111) | home search component tag | 홈 검색 액션 표시 | DOM | M1: 홈 렌더에서 버튼을 찾는다. |
| B07 (L112) | home import 문 | component import 철자 | DELETE | D1: auto-import 등 동일 동작을 막는다. |
| B08 (L121) | reader search component tag | reader 검색 액션 표시 | DOM | M1: reader 렌더에서 버튼을 찾는다. |
| B09 (L122) | reader import 문 | component import 철자 | DELETE | D1: 렌더 여부를 증명하지 않는다. |

### `bible-selection-toolbar.test.mjs` (25)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| T01 (L41) | `#above` slot 철자 | helper가 자르는 template 구조 | DELETE | D1: 사용자 동작이 아닌 test helper 전제다. |
| T02 (L48) | popover 안 selection controls | 선택 액션의 렌더 위치 | DOM | M1: 선택 후 toolbar가 bar 위에 나타나는지 검사한다. |
| T03 (L53) | popover class | 내부 class 이름 | DELETE | D1: 레이아웃 결과가 아닌 selector 철자다. |
| T04 (L58) | named slot 선언 | 내부 component API 구현 | DELETE | D1: slot 없이도 같은 UI를 구현할 수 있다. |
| T05 (L63) | absolute/bottom CSS | popover 위치 CSS 철자 | DELETE | D1: computed layout을 증명하지 않는다. |
| T06 (L68) | pointer-events CSS | navigation 상호작용 CSS | DELETE | D1: 실제 클릭 가능성을 증명하지 않는다. |
| T07 (L73) | action-menu test id | test selector | DELETE | D1: 사용자 관찰 계약이 아니다. |
| T08 (L78) | selection event wiring | 선택 상태가 controls에 반영됨 | DOM | M1: verse 선택 후 액션 표시를 검사한다. |
| T09 (L83) | emit type 선언 | TypeScript event 선언 철자 | DELETE | D1: typecheck/런타임 이벤트 테스트 대상이다. |
| T10 (L91) | copy controls in popover | 복사 메뉴 렌더 위치 | DOM | M1: copy 액션 후 메뉴 표시를 검사한다. |
| T11 (L96) | copy format keys | 세 복사 형식 노출 | DOM | M1: 메뉴 항목과 선택 결과를 검사한다. |
| T12 (L101) | copy-menu test id | test selector | DELETE | D1: 메뉴 동작과 무관하다. |
| T13 (L106) | exposed handler names | 내부 expose 객체 철자 | DELETE | D1: 복사 결과를 증명하지 않는다. |
| T14 (L145) | audio in above area | audio controls 인접 렌더 | DOM | M1: reader 상태별 렌더 트리를 검사한다. |
| T15 (L146) | progress area in above | 통독 progress 인접 렌더 | DOM | M1: 사용자에게 보이는 진행 UI다. |
| T16 (L147) | center prev/info/next | 하단 navigation 순서/접근성 | DOM | M1: role/name과 DOM 순서를 검사한다. |
| T17 (L161) | share emit payload | 선택 verse range 전달 | DOM | M1: share 클릭 후 emitted payload를 검사한다. |
| T18 (L171) | generated share URL 사용 | 공유 payload URL | UNIT | U2: share payload builder를 직접 호출한다. |
| T19 (L176) | verse query 생성 | 공유 URL의 verse/range 값 | UNIT | U1: page-state URL generator 결과를 검사한다. |
| T20 (L189) | verse-range parser | 단일 절/범위 query 파싱 | UNIT | U1: 이미 export된 parser를 직접 호출한다. |
| T21 (L194) | entry query capture | 진입 시 pending focus | DOM | M1: route를 주고 component 상태/결과를 검사한다. |
| T22 (L199) | reader focus invocation | load 후 range focus | DOM | M2: 렌더된 절 강조/스크롤이 계약이다. |
| T23 (L204) | route watcher condition | verse-only route 변경 반응 | DOM | M1: route 갱신 후 렌더 변화를 검사한다. |
| T24 (L209) | reader forwarding method | page-to-viewer focus 전달 | DOM | M2: component ref를 통한 실제 focus를 검사한다. |
| T25 (L214) | highlight + scroll calls | 범위 강조와 첫 절 스크롤 | DOM | M2: DOM class/scroll 위치로 검증한다. |

### `date-format-local-timezone.test.mjs` (1)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| D01 (L74) | `YYYY-MM-DD` output | 오늘 날짜 key 형식 | UNIT | U1: 실제 pure helper 출력 단언이다. |

### `hasena-completion-button.test.mjs` (2)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| H01 (L29) | inline button + click | 완료 버튼 표시/클릭 | DOM | M1: 버튼을 클릭해 완료 액션을 관찰한다. |
| H02 (L34) | action before streak | 완료 액션의 시각적 순서 | DOM | M1: 렌더 DOM 순서로 검사한다. |

### `hasena-formatters.test.mjs` (9)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| HF01 (L21) | verse 31 HTML | parser가 만든 verse number markup | UNIT | U1: 실제 formatter 출력이다. |
| HF02 (L22) | verse text HTML | 두 번째 verse text 출력 | UNIT | U1: 실제 formatter 출력이다. |
| HF03 (L36) | OCR text fragment | OCR-like 본문 보존 | UNIT | U1: 실제 parsed value다. |
| HF04 (L37) | OCR verse markup | OCR verse number 출력 | UNIT | U1: 실제 formatter 출력이다. |
| HF05 (L51) | final verse text | lost-marker 분할의 마지막 내용 | UNIT | U1: 실제 parsed value다. |
| HF06 (L62) | middle verse text | generic marker 분할 내용 | UNIT | U1: 실제 parsed value다. |
| HF07 (L78) | summary section output | markdown section 변환 | UNIT | U1: 실제 formatter 출력이다. |
| HF08 (L79) | highlight span output | bold-to-highlight 변환 | UNIT | U1: 실제 formatter 출력이다. |
| HF09 (L80) | checklist output | checklist item 변환 | UNIT | U1: 실제 formatter 출력이다. |

### `hasena-tooltip-style.test.mjs` (2)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| HT01 (L11) | `overflow: visible` | summary card CSS 철자 | DELETE | D1: tooltip이 실제로 잘리지 않는지 증명하지 않는다. |
| HT02 (L16) | `z-index: 60` | tooltip stacking 숫자 | DELETE | D1: 실제 stacking/가시성을 증명하지 않는다. |

### `hasena-video-embed-url.test.mjs` (3)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| HV01 (L63) | URL builder 이름 | 내부 helper 호출 존재 | DELETE | D1: iframe의 최종 src를 보지 않는다. |
| HV02 (L64) | JS API helper 이름 | 내부 helper 호출 존재 | DELETE | D1: 초기 URL 결과를 보지 않는다. |
| HV03 (L81) | nested builder call | iframe 최초 src에 `enablejsapi` | DOM | M1: mount 직후 iframe `src` 값으로 검사한다. |

### `landing-navigation.test.mjs` (48)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| L01 (L61) | `/hasena` link | 하세나 quick access 목적지 | DOM | M1: 렌더 href/클릭 route를 검사한다. |
| L02 (L62) | 하세나 라벨 | quick access 표시 텍스트 | DOM | M1: 사용자 표시 결과다. |
| L03 (L63) | Hasena test id | selector 철자 | DELETE | D1: 카드 동작과 무관하다. |
| L04 (L72) | `/plan` link | 통독 카드 목적지 | DOM | M1: 렌더 href/클릭 route를 검사한다. |
| L05 (L73) | `/plans` link | 계획 관리 목적지 | DOM | M1: 렌더 href/클릭 route를 검사한다. |
| L06 (L74) | `plan-pill` class | 내부 class 철자 | DELETE | D1: pill의 의미/동작을 증명하지 않는다. |
| L07 (L75) | Settings icon | 설정 액션 시각 표시 | DOM | M1: 렌더된 버튼/icon accessible name을 검사한다. |
| L08 (L84) | `/scoreboard` link | 순위 quick access | DOM | M1: 렌더 목적지 계약이다. |
| L09 (L85) | `/friends` link | 친구 quick access | DOM | M1: 렌더 목적지 계약이다. |
| L10 (L88) | nav `/bible` link | floating nav 성경 목적지 | DOM | M1: 렌더 목적지 계약이다. |
| L11 (L107) | white background | floating nav CSS 색상 철자 | DELETE | D1: computed opacity/시각 결과를 보지 않는다. |
| L12 (L110) | white bottom-bar background | 공용 bar CSS 색상 철자 | DELETE | D1: 실제 불투명도를 보지 않는다. |
| L13 (L117) | sub-card flex | 카드 layout 구현 | DELETE | D1: flex 외 구현을 부당하게 막는다. |
| L14 (L118) | align-items center | icon/label 정렬 CSS | DELETE | D1: 실제 정렬 결과를 보지 않는다. |
| L15 (L119) | card-main flex | 통독 링크 layout 구현 | DELETE | D1: 사용자 결과가 아닌 CSS 철자다. |
| L16 (L123) | root no-store header | landing route cache policy | KEEP | K1: Nitro가 소비하는 정확한 route-rule/header 값이다. |
| L17 (L127) | auth helper in hero | composable 호출 철자 | DELETE | D1: visitor greeting 결과를 증명하지 않는다. |
| L18 (L128) | auth helper in card | composable 호출 철자 | DELETE | D1: 동일 상태 사용 결과를 증명하지 않는다. |
| L19 (L129) | auth helper in quick access | composable 호출 철자 | DELETE | D1: profile link 결과를 증명하지 않는다. |
| L20 (L130) | auth helper in nav | composable 호출 철자 | DELETE | D1: profile link 결과를 증명하지 않는다. |
| L21 (L131) | cached user read | cached auth parsing/first paint | UNIT | U2: cache parser와 display-user resolver를 분리한다. |
| L22 (L132) | state variable name | `isFirstPaintPending` 철자 | DELETE | D1: pending 결과가 아닌 변수명이다. |
| L23 (L133) | hydration pending formula | first-paint policy | UNIT | U2: hydration flag-to-view-state 결정으로 추출한다. |
| L24 (L134) | display-user formula | stale cached user 제거 정책 | UNIT | U2: auth/cached 상태의 pure resolver로 검사한다. |
| L25 (L135) | mounted hydration mutation | pending 종료 | DOM | M1: mount 전후 rendered shell 변화를 검사한다. |
| L26 (L136) | visitor greeting | 비로그인 hero 문구 | DOM | M1: auth 상태별 visible text를 검사한다. |
| L27 (L137) | WELCOME label | 비로그인 card label | DOM | M1: 상태별 visible text를 검사한다. |
| L28 (L138) | login CTA copy | 비로그인 CTA | DOM | M1: visible text/line break를 검사한다. |
| L29 (L139) | visitor description | 비로그인 설명 | DOM | M1: visible text를 검사한다. |
| L30 (L140) | login action copy | 비로그인 action text | DOM | M1: visible action을 검사한다. |
| L31 (L153) | `loading="eager"` | landing logo loading hint | KEEP | K1: 브라우저가 직접 소비하는 image hint다. |
| L32 (L154) | preload relation | logo preload hint | KEEP | K1: 브라우저가 소비하는 head link relation이다. |
| L33 (L155) | logo asset href | preload 대상 asset | KEEP | K1: browser preload의 정확한 기계 소비 경로다. |
| L34 (L156) | high fetch priority | logo priority hint | KEEP | K1: 브라우저가 직접 소비하는 값이다. |
| L35 (L157) | width 376 | intrinsic logo width | KEEP | K1: 브라우저 layout reservation 입력이다. |
| L36 (L158) | height 99 | intrinsic logo height | KEEP | K1: 브라우저 layout reservation 입력이다. |
| L37 (L162) | shell marker 이름 | style/test marker 철자 | DELETE | D1: first paint를 증명하지 않는다. |
| L38 (L163) | skeleton element | 초기 skeleton 표시 | DOM | M1: SSR/mount 전후 렌더를 검사한다. |
| L39 (L164) | content element | SSR content 즉시 존재 | DOM | M1: SSR output/렌더 가시성을 검사한다. |
| L40 (L165) | `isShellReady` 이름 | 내부 상태 변수명 | DELETE | D1: dismiss 동작을 증명하지 않는다. |
| L41 (L169) | `requestAnimationFrame` | scheduling 구현 철자 | DELETE | D1: 실제 reveal 시점/결과가 계약이다. |
| L42 (L170) | skeleton selector | CSS selector 철자 | DELETE | D1: 스타일 적용 결과를 보지 않는다. |
| L43 (L171) | pointer-events CSS | click-through 구현 철자 | DELETE | D1: 실제 click 가능성을 증명하지 않는다. |
| L44 (L172) | timeout animation | fallback CSS 구현 | DELETE | D1: timeout 후 가시성을 증명하지 않는다. |
| L45 (L173) | keyframe 이름 | 내부 animation 이름 | DELETE | D1: 이름만 맞추면 동작이 깨져도 통과한다. |
| L46 (L175) | mounted reveal call | 내부 함수 호출 철자 | DELETE | D1: mount 후 skeleton 제거를 직접 봐야 한다. |
| L47 (L184) | eager logos loop | 9개 상단 logo loading hint | KEEP | K1: 각 surface에서 브라우저가 소비하는 image hint다. |
| L48 (L189) | `/intro` link | intro quick access 목적지 | DOM | M1: 렌더 href/클릭 route를 검사한다. |

### `landing-shell-performance.test.mjs` (4)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| LS01 (L19) | mounted reveal call | 내부 lifecycle 호출 철자 | DELETE | D1: mount 결과를 증명하지 않는다. |
| LS02 (L20) | animation property | CSS fallback 구현 | DELETE | D1: skeleton dismiss 결과를 보지 않는다. |
| LS03 (L21) | keyframe 이름 | 내부 CSS 이름 | DELETE | D1: 리팩터링에 취약하다. |
| LS04 (L22) | 100% opacity/visibility | keyframe CSS 철자 | DELETE | D1: 실제 가시성을 측정하지 않는다. |

### `notifications-contract.test.mjs` (30)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| N01 (L122) | header component symbol | import/component 이름 | DELETE | D1: 알림 링크 렌더를 증명하지 않는다. |
| N02 (L123) | header notifications route | header 알림 목적지 | DOM | M1: 렌더 href/클릭 route를 검사한다. |
| N03 (L124) | PageHeader symbol | import/component 이름 | DELETE | D1: 알림 링크 렌더를 증명하지 않는다. |
| N04 (L125) | PageHeader route | page header 알림 목적지 | DOM | M1: 렌더 목적지 계약이다. |
| N05 (L126) | aria label binding | 알림 링크 accessible name | DOM | M1: role/name 질의로 검사한다. |
| N06 (L127) | unread-count label | 읽지 않은 개수 안내 | DOM | M1: store 상태별 accessible name을 검사한다. |
| N07 (L128) | Bell icon symbol | icon 이름 철자 | DELETE | D1: 메뉴 액션 존재를 증명하지 않는다. |
| N08 (L129) | 알림 menu label | 메뉴 알림 액션 표시 | DOM | M1: visible menu item으로 검사한다. |
| N09 (L134) | interface names | store 타입 선언 철자 | DELETE | D1: 생성 타입/typecheck가 담당한다. |
| N10 (L136) | `fetchInbox` 이름 | store method 이름 | DELETE | D1: 다음 케이스의 실행 테스트와 중복이다. |
| N11 (L137) | `markAsRead` 이름 | store method 이름 | DELETE | D1: rollback 실행 테스트와 중복이다. |
| N12 (L138) | `updateSettings` 이름 | store method 이름 | DELETE | D1: 응답 적용 실행 테스트와 중복이다. |
| N13 (L139) | push-enable 이름 | store method 이름 | DELETE | D1: 실제 구독 동작을 증명하지 않는다. |
| N14 (L140) | push-disable 이름 | store method 이름 | DELETE | D1: 실제 해지 동작을 증명하지 않는다. |
| N15 (L141) | push subscription API path | backend endpoint | KEEP | K1: API 라우터가 소비하는 정확한 경로다. |
| N16 (L142) | SW path/scope | `/notification-sw.js`, `/` scope | KEEP | K1: Service Worker registration이 직접 소비한다. |
| N17 (L143) | SW ready | registration readiness 흐름 | DOM | M2: browser에서 readiness 후 구독을 검사한다. |
| N18 (L231) | inbox title | 알림 페이지 제목 | DOM | M1: visible heading을 검사한다. |
| N19 (L232) | empty-state copy | 빈 inbox 안내 | DOM | M1: 빈 store 상태를 렌더한다. |
| N20 (L233) | `word-break` CSS | CJK CSS 철자 | DELETE | D1: 실제 줄바꿈 결과를 증명하지 않는다. |
| N21 (L234) | settings title | 알림 설정 heading | DOM | M1: visible heading을 검사한다. |
| N22 (L236) | five setting labels | 푸시/전체/통독/하세나/친구 controls | DOM | M1: 각 control label과 state를 검사한다. |
| N23 (L238) | time input | reminder time control | DOM | M1: role/value와 변경 결과를 검사한다. |
| N24 (L242) | `push` event name | push event registration | KEEP | K1: Service Worker가 소비하는 표준 event 문자열이다. |
| N25 (L243) | showNotification call | OS notification 표시 | DOM | M2: worker event 또는 browser notification mock으로 검사한다. |
| N26 (L244) | `notificationclick` event | click event registration | KEEP | K1: Service Worker가 소비하는 표준 event 문자열이다. |
| N27 (L245) | clients match | 기존 app client 재사용 | DOM | M2: worker runtime에서 focus/navigate를 관찰한다. |
| N28 (L246) | openWindow call | client 없을 때 app 열기 | DOM | M2: worker runtime side effect를 검사한다. |
| N29 (L247) | same-origin guard | 외부 notification URL 차단 | UNIT | U2: `notificationTargetUrl(value, origin)`으로 추출한다. |
| N30 (L248) | `/notifications` fallback | 안전한 기본 app route | KEEP | K1: worker가 navigation에 소비하는 정확한 fallback 경로다. |

### `page-layout-contract.test.mjs` (6)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| PL01 (L116) | bible header class | 전용 header selector 철자 | DELETE | D1: 전용 header 존재를 증명하지 않는다. |
| PL02 (L125) | border CSS | PageHeader border 철자 | DELETE | D1: 시각 결과가 아닌 구현이다. |
| PL03 (L127) | width 36px | back button CSS 폭 | DELETE | D1: touch/accessibility 결과를 보지 않는다. |
| PL04 (L128) | height 36px | back button CSS 높이 | DELETE | D1: touch/accessibility 결과를 보지 않는다. |
| PL05 (L196) | SSR notification fallback | custom action 없을 때 알림 링크 | DOM | M1: 이미 SSR render 결과를 검사한다. |
| PL06 (L198) | SSR custom action | custom header action slot | DOM | M1: 이미 SSR render 결과를 검사한다. |

### `profile-achievements-ux.test.mjs` (1)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| PA01 (L11) | `assertContract` wrapper | 그룹/탭/잠금 cue/접근성 source 패턴 | DOM | M1: wrapper 호출들은 모두 achievement 렌더 상태를 질의해야 한다. |

### `reading-position.test.mjs` (24)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| R01 (L237) | explicit-scroll flag | reader event를 explicit로 표시 | UNIT | U2: reader scroll state reducer로 추출한다. |
| R02 (L242) | position state update | 현재 scroll ratio 저장 | UNIT | U2: 상태 전이 입출력으로 검사한다. |
| R03 (L247) | source flag update | reader/window scroll 구분 | UNIT | U2: 상태 전이 입출력으로 검사한다. |
| R04 (L252) | save args | event position persistence payload | UNIT | U2: save command builder로 추출한다. |
| R05 (L257) | explicit getter | reader event 전후 fallback 결정 | UNIT | U2: 순수 selector로 추출한다. |
| R06 (L262) | unload save args | unload persistence payload | UNIT | U2: command builder 결과를 검사한다. |
| R07 (L270) | alias 이름 | destructuring alias 철자 | DELETE | D1: restore 결과와 무관하다. |
| R08 (L275) | helper signature | 내부 함수명/타입 철자 | DELETE | D1: restore 동작을 증명하지 않는다. |
| R09 (L280) | viewer restore invocation | inner scroll restore | DOM | M2: 실제 scrollTop 결과를 검사한다. |
| R10 (L285) | reader forwarding method | nested viewer restore | DOM | M2: component ref와 scroll 결과를 실행한다. |
| R11 (L290) | reset transition | 새 위치에서 explicit state reset | UNIT | U2: scroll state reducer로 검사한다. |
| R12 (L295) | setter signature/default | 내부 함수 선언 철자 | DELETE | D1: reset 결과가 계약이다. |
| R13 (L300) | explicit flag assignment | save source 상태 | UNIT | U2: reducer/selector 결과로 검사한다. |
| R14 (L305) | event-save sequence | reader scroll save command | UNIT | U2: event-to-command 함수로 추출한다. |
| R15 (L310) | clamped scrollTop | 0 포함 ratio restore | DOM | M2: scroll container 치수와 scrollTop이 필요하다. |
| R16 (L315) | load-before-restore | 콘텐츠 로드 후 scroll 복원 | DOM | M2: async component/render 순서를 검사한다. |
| R17 (L323) | route-change reset decision | deep link 위치 변경 정책 | UNIT | U2: query-to-load/reset command로 추출한다. |
| R18 (L328) | auto-save args | 자동 저장의 explicit position | UNIT | U2: command builder 결과로 검사한다. |
| R19 (L336) | KNT query params | proxy URL encoding | UNIT | U2: KNT proxy URL builder를 export한다. |
| R20 (L341) | standard query params | proxy URL encoding | UNIT | U2: standard proxy URL builder를 export한다. |
| R21 (L349) | Python validator body | scroll range 검사 구현 철자 | DELETE | D1: frontend source test가 backend 구현을 고정한다. |
| R22 (L354) | Python book validator body | book 검증 구현 철자 | DELETE | D1: backend serializer 실행 테스트가 담당해야 한다. |
| R23 (L359) | Python version validator body | version 검증 구현 철자 | DELETE | D1: backend serializer 실행 테스트가 담당해야 한다. |
| R24 (L364) | Python chapter validator body | chapter bounds 구현 철자 | DELETE | D1: backend API/serializer 동작 테스트가 담당해야 한다. |

### `scoreboard-hasena-activity.test.mjs` (8)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| SH01 (L19) | field type declaration | `hasena_completed_days` 타입 철자 | DELETE | D1: 생성 API 타입/typecheck 대상이다. |
| SH02 (L20) | field type declaration | `activity_score` 타입 철자 | DELETE | D1: store 동작을 증명하지 않는다. |
| SH03 (L21) | field type declaration | `current_hasena_streak` 타입 철자 | DELETE | D1: store 동작을 증명하지 않는다. |
| SH04 (L25) | activity score render | row의 합산 점수 표시 | DOM | M1: fixture를 렌더해 visible value를 검사한다. |
| SH05 (L26) | Bible/Hasena breakdown | row의 활동 내역 표시 | DOM | M1: visible breakdown text를 검사한다. |
| SH06 (L30) | activity score label | page의 점수 의미 표시 | DOM | M1: heading/label을 검사한다. |
| SH07 (L31) | prop wiring syntax | 내부 prop 전달 철자 | DELETE | D1: 실제 row 값으로 검사해야 한다. |
| SH08 (L32) | Hasena page value | entry의 Hasena 완료 일수 표시 | DOM | M1: fixture별 visible value를 검사한다. |

### `scoreboard-ux-contract.test.mjs` (1)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| SU01 (L19) | `assertContract` wrapper | 설명/로그인/empty/mobile/a11y/month source 패턴 | DOM | M1: 각 상태와 viewport의 렌더 결과로 전환해야 한다. |

### `sns-certification-contract.test.mjs` (1)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| SC01 (L20) | `assertContract` wrapper | 인증 카드/모달/완료/공유 source 패턴 | DOM | M1: 다수 호출 중 지배적 계약은 modal 렌더와 사용자 액션이다. 순수 share 로직은 별도 runtime 파일이 이미 다룬다. |

### `sns-certification-share-runtime.test.mjs` (5)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| SR01 (L162) | history URL prefix | PNG 실패 fallback URL | UNIT | U1: 실제 composable 실행 결과다. |
| SR02 (L163) | certification query | 인증 링크 종류 | UNIT | U1: 실제 URL 출력이다. |
| SR03 (L164) | plan id query | 완료 plan context | UNIT | U1: 실제 URL 출력이다. |
| SR04 (L165) | schedule id query | 완료 schedule context | UNIT | U1: 실제 URL 출력이다. |
| SR05 (L166) | date query | 인증 날짜 context | UNIT | U1: 실제 URL 출력이다. |

### `tongdok-audio-speed.test.mjs` (7)

| ID (원본 행) | 단언 | 무엇을 고정하는지 | 판정 | 근거 |
|---|---|---|---|---|
| AS01 (L11) | speed-control test id | test selector | DELETE | D1: control 동작과 무관하다. |
| AS02 (L16) | floating class | 내부 class 이름 | DELETE | D1: 위치/동작을 증명하지 않는다. |
| AS03 (L21) | progress-row DOM order | speed control 위치와 close 인접성 | DOM | M1: videoId 상태를 렌더해 DOM 순서를 검사한다. |
| AS04 (L31) | iframe CSS selector | 숨김 구현 selector | DELETE | D1: 실제 가시성을 증명하지 않는다. |
| AS05 (L39) | TS method signature | YouTube player 타입 철자 | DELETE | D1: typecheck와 runtime call이 담당한다. |
| AS06 (L44) | five playback rates | 허용 재생 속도 값 | UNIT | U2: exported rate policy/validator로 검사한다. |
| AS07 (L49) | player API call | 속도 선택의 side effect | DOM | M1: 메뉴 클릭 후 fake player 호출을 관찰한다. |

## 단언이 0개가 된 테스트 케이스

케이스는 삭제하지 않았고 이름과 본문을 유지했다. 아래 네 케이스는 DELETE 제거 후 남은 `assert.*`가 0개다.

| 파일 | 테스트 케이스 | 원래 의도 | 전환 후보 |
|---|---|---|---|
| `hasena-tooltip-style.test.mjs` | `keeps beta tooltip above the summary card without clipping` | tooltip이 card에 잘리지 않고 위에 겹쳐 보임 | **DOM/M2**: 실제 browser layout 또는 screenshot에서 bounding box와 가시성을 검사 |
| `landing-navigation.test.mjs` | `landing quick access cards align icon and title in one row` | icon/title의 한 줄 정렬 | **DOM/M2**: viewport별 bounding box 또는 visual regression |
| `reading-position.test.mjs` | `backend serializer rejects invalid reading position payloads` | 잘못된 scroll/book/version/chapter 거부 | **UNIT** 후보이지만 소유권은 backend serializer/API 테스트에 있음; frontend에서 source를 읽지 말 것 |
| `scoreboard-hasena-activity.test.mjs` | `scoreboard models Hasena activity fields from the API contract` | API activity field를 store가 받아 보존함 | **UNIT**: fixture 응답을 store에 적용해 값/derived score를 검사하거나 생성 OpenAPI 타입으로 계약 확인 |

## UNIT 전환에 필요한 로직 추출

### 추출이 필요한 항목

| 대상 | 제안 위치/함수 | 포함할 현재 계약 |
|---|---|---|
| 계정 삭제/제공자 표시 | 기존 `app/utils/accountSettingsRuntime.js`에 `buildDeleteAccountPayload`, `getProviderDisplayName` | password/`confirm_delete`, provider label mapping |
| OAuth callback 입력/merge 오류 | `app/utils/oauthCallbackRuntime.ts`에 `parseOAuthCallbackInput`, `buildOAuthCallbackPayload`, `parseMergeInfo` | first query value, state/code/provider, backend `merge_token` 보존 |
| native redirect scheme | 새 `shared/utils/oauthRedirect.ts`에 `isSignedLinkState`, `getSafeAppScheme`, `resolveNativeRedirect` | `maeil1dok`/`maeil1dok-dev` 허용, 임의 scheme 거부; app/server 중복 제거 |
| auth 초기화 정책 | `app/utils/authSessionPolicy.ts`에 `selectInitialUserFetch`, `shouldLogoutAfterRefreshFailure` | cached session은 refresh recovery, anonymous는 direct user fetch, 명시적 revalidate만 logout |
| Bible cache 검색 snippet | `app/utils/bibleSearchSnippet.ts`에 `sanitizeBibleSearchSnippet`, `highlightBibleSearchSnippet` | entity decode, source noise 제거, HTML escape, query 강조 |
| 검색 result/query | 같은 utility 또는 `app/utils/bibleSearchRoute.ts`에 `buildBibleSearchResultQuery`, `parseSearchFocusParam` | verse/search query 보존과 빈 값 정규화 |
| cache-first fetch | 기존 `app/composables/bible/bibleFetchClient.ts`에서 `fetchWithCacheFallback`을 fetch dependency와 함께 export | cache → proxy → cache fallback 호출 순서와 standard/KNT 결과 |
| Bible proxy URL | 같은 파일에 `buildKntProxyUrl`, `buildStandardProxyUrl` | `URLSearchParams` 인코딩과 query key/value |
| Bible share route | `app/composables/bible/useBiblePageState.ts`의 `formatVerseRangeParam` export 및 origin을 인자로 받는 `buildBibleShareUrl` | single/range parse-format round trip과 share query |
| landing auth first paint | `app/utils/landingAuthState.ts`에 `parseCachedAuthUser`, `resolveLandingDisplayUser`, `resolveFirstPaintState` | cached user 검증, auth settle 후 stale cache 제거, hydration pending 결정 |
| reader scroll state | `app/composables/bible/useReaderScrollState.ts` 또는 pure reducer utility | explicit reader flag, reset, getter, save command payload, route-change reset decision |
| notification URL safety | `public/notification-sw.js`에서 import 가능한 `app/utils/notificationRuntime.js`의 `resolveNotificationTargetUrl` | same-origin 허용, 외부 origin 거부, `/notifications` fallback |
| audio speed 정책 | `TongdokAudioPlayer.vue`의 rate 상수를 `app/utils/tongdokAudioRuntime.ts`로 이동해 `PLAYBACK_RATES`, `isPlaybackRate` export | 0.75/1/1.25/1.5/2 허용 값 |

### 추출 없이 바로 UNIT으로 바꿀 수 있는 항목

- `app/utils/dateFormat.ts`, `app/utils/hasenaFormatters.js`, `app/utils/hasenaVideoUrl.js`, `app/utils/bibleSearch.ts`, `app/utils/accountSettingsRuntime.js`는 이미 직접 실행 가능한 모듈이다.
- `mobile/urlRedaction.ts`는 현재 테스트의 esbuild 패턴으로 import해 key별 redaction을 직접 실행할 수 있다.
- `server/plugins/error-logger.ts`의 redaction 함수는 이미 transform/import해 실제 출력을 검사한다.
- `useReadingPosition.ts`와 `useCertificationShare.ts`도 현재 파일에서 browser dependency를 명시적으로 stub하고 실행하고 있다.
- `parseVerseRangeParam`은 이미 export되어 있으므로 source 정규식 대신 table-driven 호출만 추가하면 된다.

## DOM 전환 도구 선택지

현재 기본 runner는 `node --test`다. 아래는 결정안이 아니라 선택지 비교이며, 이번 작업에서는 설치/설정을 변경하지 않았다.

| 선택지 | 설치/설정 규모 | CI 시간 | 학습 비용 | 장점 | 한계/적합 영역 |
|---|---|---|---|---|---|
| `@vue/test-utils` + `Vitest` + `happy-dom` | 중간: runner, Vue mount adapter, DOM 구현 추가 | 빠름 | 중간 | Vue component click/input/emitted/접근성 속성을 빠르게 검사 | Nuxt auto-import/router/plugin stub을 직접 관리; 실제 layout/scroll 계산은 부정확 |
| `@nuxt/test-utils` + `Vitest` + `happy-dom` | 큼: Nuxt test environment와 관련 의존성 추가 | 중간 | 낮음~중간 | `mountSuspended`, Nuxt auto-import/router/plugin mocking이 자연스러움 | 설치량과 환경 bootstrap 비용이 큼; CSS layout은 여전히 가상 DOM 한계 |
| `@vue/test-utils` + `Vitest` + `jsdom` | 중간 | 빠름~중간 | 중간 | 생태계/문서가 넓고 표준 DOM API 호환성이 높음 | layout, scroll, IntersectionObserver 등은 stub 필요; Nuxt 통합은 수동 |
| 기존 `@playwright/test`로 Nuxt E2E | 작음~중간: 의존성은 이미 선언되어 있으나 config/server fixture/script 필요 | 느림 | 중간 | 실제 browser layout, focus, scroll, navigation, Service Worker를 검증 | server 기동, fixture/auth 격리, browser binary CI 비용; 작은 분기 테스트에는 무거움 |
| Playwright component testing | 중간~큼 | 중간~느림 | 중간~높음 | 실제 browser에서 component 단위 상호작용/레이아웃 확인 | Nuxt plugin/auto-import 환경 접합이 별도 과제이고 E2E보다 설정 이점이 작을 수 있음 |
| 현행 `node:test` + `@vue/compiler-sfc` + `@vue/server-renderer` | 추가 설치 없음 | 매우 빠름 | 낮음 | 이 repo의 `page-layout-contract`처럼 SSR template 출력, slot/조건부 텍스트 검사 가능 | click/focus/browser layout/서비스워커는 불가; template AST source 검사를 DOM 테스트로 오인하면 안 됨 |

도구 선택 기준은 두 층으로 나누는 것이 안전하다.

1. 조건부 텍스트, href, aria-label, slot fallback처럼 SSR로 충분한 것은 기존 compiler + server renderer로 먼저 전환할 수 있다.
2. click/focus/scroll/stacking/Service Worker처럼 browser semantics가 핵심인 것만 가상 DOM 또는 Playwright 대상으로 남긴다.

## DOM 없이 가능한 전환

- **SFC SSR render**: `compileTemplate` + `createSSRApp` + `renderToString`으로 조건부 라벨, 링크 href, aria 속성, slot fallback을 실제 렌더 결과에서 검사한다. 이미 `page-layout-contract.test.mjs`에 선례가 있다.
- **emitted payload 분리**: share/navigation payload 생성은 pure builder로 빼고 Node 단위 테스트를 한다. 컴포넌트에는 클릭이 builder를 호출하는 얇은 DOM 테스트 하나만 둔다.
- **store 실행**: `notifications-contract`처럼 esbuild plugin으로 Pinia/API dependency를 stub해 store action의 응답 적용과 rollback을 Node에서 검사한다.
- **Service Worker pure core**: target URL 결정과 push payload 정규화는 일반 함수로 분리해 Node에서 검사한다. event 등록, `showNotification`, client focus/open만 실제 browser/worker 테스트로 남긴다.
- **TypeScript source transform**: repo의 기존 esbuild data-URL import 패턴을 사용하면 `.ts` utility를 별도 runner 없이 실행할 수 있다.
- **접근성의 일부**: SSR HTML의 `aria-label`, role, label-control 연결은 Node에서 확인 가능하다. focus 이동, keyboard interaction, accessible tree 품질은 browser/DOM 도구가 필요하다.

## 실제 제거 내역

| 파일 | 제거한 DELETE 호출 수 |
|---|---:|
| `account-settings-contract.test.mjs` | 11 |
| `app-startup-performance.test.mjs` | 3 |
| `auth-session-safety.test.mjs` | 5 |
| `bible-cache-search-ui.test.mjs` | 1 |
| `bible-search.test.mjs` | 3 |
| `bible-selection-toolbar.test.mjs` | 9 |
| `hasena-tooltip-style.test.mjs` | 2 |
| `hasena-video-embed-url.test.mjs` | 2 |
| `landing-navigation.test.mjs` | 20 |
| `landing-shell-performance.test.mjs` | 4 |
| `notifications-contract.test.mjs` | 10 |
| `page-layout-contract.test.mjs` | 4 |
| `reading-position.test.mjs` | 7 |
| `scoreboard-hasena-activity.test.mjs` | 4 |
| `tongdok-audio-speed.test.mjs` | 4 |
| **합계** | **89** |

`assert.match` 정적 호출 지점은 288개에서 199개로 줄었다. 테스트 케이스는 삭제하지 않았으며 검증 시 전체 153개를 유지해야 한다.

---

## 도구 결정 (이 감사 직후)

위 비교표는 선택지였다. **결정은 다음과 같다.**

### 새 테스트 러너를 추가하지 않는다

| 층 | 수단 | 추가 설치 |
|---|---|---|
| UNIT | 순수 모듈로 추출 + 기존 `node --test` (`.ts` 는 esbuild data-URL import) | 없음 |
| DOM 중 SSR 로 되는 것 | `@vue/compiler-sfc` + `@vue/server-renderer` (선례: `page-layout-contract`) | 없음 |
| 진짜 브라우저 의미 | 이미 `package.json` 에 선언된 `@playwright/test`, Chromium 하나만 | 없음 |
| KEEP | 그대로 둔다 | — |

**Vitest + `@vue/test-utils` + happy-dom 을 택하지 않은 이유가 결정적이다.** 러너가 하나뿐인
리포에 두 번째 러너와 가짜 DOM 을 들이는 거래인데, 가짜 DOM 은 **툴팁 잘림·요소 쌓임·스크롤
위치처럼 정작 우리가 어려워하는 경우에 틀린 답**을 준다. 쉬운 경우(조건부 텍스트, `href`,
`aria-*`)는 애초에 DOM 이 필요 없고, 어려운 경우는 Playwright 가 진짜 답을 준다.
설치 비용을 내고 근사값을 사는 셈이라 채택하지 않았다.

Playwright e2e 는 `frontend/tests/e2e/**` 에 둔다. 기존 러너의 glob 이
`tests/*.test.mjs` 로 **비재귀**이므로 하위 디렉터리는 섞이지 않는다 — 이 성질에 의존하고 있으니
글롭을 바꾸지 마라. 백엔드는 띄우지 않고 `page.route()` 로 API 를 가로막되 응답 형태는
생성 타입에 맞춘다(API 계약은 `backend/schema.yml` 과 골든 특성화 테스트가 이미 지킨다).

### 진행률 지표를 정정한다 — `assert.match` 총수는 지표가 아니다

이 문서가 "288개"라고 부른 수는 `assert.match` 총수인데, 그 수는 취약성을 재지 못한다.
**첫 인자가 무엇이냐로 성격이 완전히 갈린다:**

```js
assert.match(redactSensitiveUrl(input), /\[redacted\]/)      // 실제 반환값 → 동작 검사
assert.match(renderedHtml, /aria-label="계정 설정"/)          // SSR 렌더 결과 → 동작 검사
assert.match(scriptSetupSource, /import BibleSearchButton/)  // 소스 텍스트 → 취약
```

그래서 **소스 기반 단언 수**만 세는 계수기를 만들었다:

```sh
cd frontend && node scripts/source-assertion-count.mjs [--json]
```

이 지표를 쓴 덕에 전환 도중 **역행 하나를 잡았다** — 한 파일이 소스 단언 1개에서 16개로
늘어난 것(CSS 변수 철자, `@click="..."` 템플릿 속성, 함수 시그니처 철자)을 발견해 되돌렸다.
`assert.match` 총수만 봤다면 "단언이 늘었네"로 넘어갔을 것이다.

**소스 기반이 줄어드는 방향만이 옳다.** 늘리는 변경은 이유를 적어야 한다.
