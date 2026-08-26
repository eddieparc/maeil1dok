# API 계약의 소비자 지도

이 API는 소비자가 **셋**이다. 계약을 바꿀 때 무엇이 깨지는지는 소비자마다 다르고,
특히 모바일 셸은 **되돌리는 비용이 가장 크다**. 1단계(계약 SSOT) 작업의 전제 자료다.

측정 시점: 2026-08-26. 근거 명령은 각 절에 적었다.

---

## 1. 소비자별 표면

| 소비자 | 호출 방식 | 계약 위반 시 발견 시점 | 되돌리는 비용 |
|---|---|---|---|
| 웹 (`frontend/`) | `useApi` 계열 래퍼 경유 52파일 + 원시 `fetch` 4파일 | 런타임 (타입 공유 없음) | 웹 배포 1회 |
| **모바일 셸 (`mobile/App.tsx`)** | **원시 `fetch` 7곳, 래퍼 없음** | **런타임, 사용자 기기에서** | **앱 재배포 — OTA 도달 미확인, 최악의 경우 스토어 심사** |
| 서버 내부 | Django 내부 호출 | 테스트 | 서버 배포 1회 |

---

## 2. 모바일 셸이 직접 부르는 7개 엔드포인트 (최고 위험)

`mobile/App.tsx`. 전부 `/api/v1/auth/` prefix이며 **전부 인증 경로**다.

| 줄 | 엔드포인트 | 역할 |
|---|---|---|
| 141 | `POST /api/v1/auth/session/issue/` | 1회용 입장 코드 발급 |
| 161 | `GET /api/v1/auth/session/consume/` | 코드 소각 후 웹뷰에 세션 심기 (리다이렉트) |
| 197 | `POST /api/v1/auth/token/refresh/` | 셸 보관 토큰 갱신 |
| 234 | `POST /api/v1/auth/email-login/` | 이메일 로그인 |
| 265 / 351 / 396 | `POST /api/v1/auth/social-login/v2/` | 카카오 · 구글 · 애플 |
| 592 | `POST /api/v1/auth/logout/` | 로그아웃 |

**계약상 의미**

- 이 7개는 **응답 형태·상태 코드·쿠키 속성 중 무엇 하나만 바뀌어도 앱이 깨진다.** 셸에는 타입도 스키마 검증도 없다.
- 그런데 셸을 고치는 경로는 **OTA 도달이 아직 확인되지 않았다.** 닫혀 있으면 스토어 심사를 거쳐야 하고, 이미 설치된 사용자에게는 즉시 되돌릴 수 없다.
- 따라서 OpenAPI 스키마에서 이 7개는 **"모바일 소비" 표시를 달고 변경 금지 대상으로 취급**한다. 바꿔야 한다면 웹 경로처럼 다루지 말고 앱 배포 계획과 함께 다뤄야 한다.
- `session/consume/`는 리다이렉트 응답이라 스키마 표현이 특수하다. 자동 추론이 틀리기 쉬운 지점이다.

근거: `grep -n 'fetch(\`\${API_URL}' mobile/App.tsx`

---

## 3. 이중 prefix — 어느 쪽이 정규인가

`backend/config/urls.py:25-26`이 동일 콜백을 `/api/v1/auth/*`와 `/api/v1/accounts/*` 양쪽에 mount한다.

| 소비자 | `/api/v1/auth/` | `/api/v1/accounts/` |
|---|---|---|
| 웹 | 28 | 9 |
| 모바일 | **20** | **0** |

**판단: `/api/v1/auth/`가 사실상의 정규 prefix다.** 모바일은 `/accounts/`를 한 번도 쓰지 않는다.

`/api/v1/accounts/`를 쓰는 웹 9곳은 **스토어 3개에 모여 있다** — 제거 범위가 좁다:

- `frontend/app/stores/profile.ts` — `profile/`, `profile/{userId}/`, `profile/{userId}/achievements/`, `profile/{userId}/calendar/`
- `frontend/app/stores/readingSettings.ts` — `reading-settings/`, `reading-settings/update/`
- `frontend/app/stores/social.ts` — `followers/{userId}/`, `following/{userId}/`, `friends/`, `follow/`, `unfollow/{userId}/`, `search/`

**권고 순서**

1. (1단계) 스키마에서 `/auth/`를 정규로 삼고 `/accounts/`를 deprecated로 표시한다. **라우트는 제거하지 않는다.**
2. (이후) 위 세 스토어의 호출을 `/auth/`로 옮긴다. 웹 배포 1회로 끝나고 앱과 무관하다.
3. (그 다음) `/accounts/` mount를 제거한다. 그 시점에는 소비자가 0이어야 한다.

한 번에 3단계를 묶지 않는다 — 2와 3 사이에 배포 경계가 있어야 되돌릴 수 있다.

---

## 4. 1단계에서 지켜야 할 것

- 기존 라우트의 **경로·응답·상태 코드를 바꾸지 않는다.** 계약을 기록하는 단계지 바꾸는 단계가 아니다.
- 모바일 7개는 스키마에 반드시 포함하고 소비자 표시를 단다. 스키마에서 누락되면 "아무도 안 쓰는 라우트"로 오인돼 다음 단계에서 지워질 수 있다.
- 웹의 계약 검증은 타입 생성으로 확보되지만, **모바일에는 그런 수단이 없다.** 모바일 소비 엔드포인트의 회귀는 `backend/tests/golden/api_characterization.json`(0단계 골든)이 유일한 기계적 방어선이다.

---

## 5. 안전망 커버리지 대조 — 구멍 1개 확인

0단계 골든이 모바일 6개 고유 엔드포인트를 실제로 덮는지 대조했다.

| 엔드포인트 | 골든 | 비고 |
|---|---|---|
| `auth/session/issue/` | 커버 | |
| `auth/session/consume/` | 커버 | |
| `auth/token/refresh/` | 커버 | |
| `auth/email-login/` | 커버 | |
| **`auth/social-login/v2/`** | **제외** | 외부 OAuth 호출(카카오·구글·애플) |
| `auth/logout/` | 커버 | |

**`social-login/v2/`가 유일한 무방비 지점이다.** 그런데 이건 셸에서 **세 곳(카카오·구글·애플)이 부르는** 가장 많이 쓰이는 로그인 경로다. 정리하면:

- 소비자 중 되돌리기가 가장 비싼 것이 모바일이고,
- 그 모바일이 가장 많이 부르는 엔드포인트가
- 안전망 밖에 있다.

**권고**: 외부 OAuth 제공자를 목(mock)으로 고정한 **응답 형태 전용 계약 테스트**를 이 엔드포인트에 별도로 붙인다. 외부를 실제로 부르지 않으므로 결정적이고, 목이 응답 형태를 그대로 통과시키므로 계약 회귀는 잡힌다. 0단계 골든의 제외 사유("외부 OAuth 호출")는 유효하므로 골든에 편입하지 말고 **별도 테스트로** 둔다.

근거: `backend/tests/golden/api_characterization.json`의 `routes`/`excluded` 대조.

### 조치 완료 — `backend/tests/test_social_login_v2_contract.py` (20 테스트)

위 권고대로 구현했다. 골든에는 편입하지 않았다.

**목 경계** — 네트워크 호출 0:

| provider | 목 지점 |
|---|---|
| 카카오 · 구글 | `accounts.views.requests.get/post`를 URL로 라우팅하는 fake. 등록되지 않은 URL은 `AssertionError`로 터진다 |
| 애플 | `jwt.PyJWKClient`만 교체하고 **id_token은 테스트 내 RSA 키로 실제 RS256 서명**한다 → 프로덕션의 aud·iss·exp·서명 검증이 실제로 실행된다 |

**고정한 계약**: 성공 200 + `application/json`; 성공 JSON 키 집합 정확히 `{access, refresh, user}`(둘 다 3-세그먼트 JWT — 셸이 `session/issue/`·`token/refresh/`로 넘긴다); `user` 키 8종과 타입; `needsSignup` 페이로드(쿠키 없음); 실패 400 `{error}`; **쿠키 `access_token`·`refresh_token`의 HttpOnly=True, Secure=True, SameSite=Lax, Path=/, Max-Age=3600/2592000, Domain 전파**.

**변이 5종 전부 탐지** — JSON 키 제거, HttpOnly 끄기, SameSite 변경, 성공 코드 200→201, Max-Age 변경.

### 이 테스트가 찾아낸 프로덕션 결함

**애플 가입 시 닉네임이 항상 기본값 `사용자`가 된다.**

```
mobile/App.tsx:357              full_name: `${givenName} ${familyName}`
backend/accounts/views.py:755   nickname_suggestion = request.data.get('user_name', '')
```

셸은 `full_name`으로 보내고 뷰는 `user_name`을 읽는다. **계약이 문서화되지 않아 아무도 몰랐던 종류의 결함**이며, 이 단계가 겨냥한 문제의 전형이다.

테스트는 현재 동작을 그대로 고정만 했고 **수정하지 않았다** — 고치려면 이름을 맞춰야 하는데, 셸 쪽을 고치면 앱 배포가 필요하고 서버 쪽을 고치면 구 셸과의 호환을 따져야 한다. 제품 판단이 필요한 사안이다.
