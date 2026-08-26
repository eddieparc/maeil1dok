# 계약 SSOT 도입에서 드러난 FE↔BE 불일치

1단계(계약 SSOT)에서 OpenAPI 스키마를 세우고 프론트 호출을 그 타입 기반으로 옮기는 과정에서
드러난 사실을 모은 문서다. **고친 것과 고치지 않고 기록만 한 것을 구분**해 적었다.

측정 시점: 2026-08-26. 관련 문서: `docs/fe-api-inventory.md`(호출 지점 전수),
`docs/contract-consumers.md`(소비자 지도), `docs/authz-current-state.md`(인가 인벤토리).

---

## 1. 계약이 존재하지 않던 범위 — 고쳤다

계약을 세워 보니 스키마가 기술하지 못하는 부분이 압도적이었다. 원인은 이 리포가
function-based view 중심이라 drf-spectacular가 정적으로 추론할 수 없었기 때문이다.

| 항목 | 도입 직후 | 보강 후 |
|---|---|---|
| 응답 본문이 기술된 오퍼레이션 | 51 / 235 (22%) | **230 / 235 (98%)** |
| query 파라미터가 선언된 오퍼레이션 | 7 / 235 (3%) | **45 / 235** (파라미터 86개) |
| 재사용 컴포넌트 스키마 | 37 | **207** |

**이게 왜 결함인가**: `responses: {200: {description: "No response body"}}`는
drf-spectacular가 **추론에 실패했을 때 넣는 기본값**이다. 실제로는 JSON을 반환하는데
계약에는 본문이 없다고 적혀 있었다. 그대로 두면 프론트 타입 생성이 78%의 엔드포인트에서
아무 보호도 주지 못한다 — 즉 이 단계의 목적 자체가 달성되지 않는다.

응답 형태 보강의 근거는 **0단계 특성화 골든**(204 라우트 x 3 페르소나의 실제 관측 응답)
121개와 뷰 코드 추적 58개다. 관측치와 생성 스키마를 기계적으로 비교해 **불일치 0건**을 확인했다.

남은 5개는 전부 `DELETE`이고 실제 `204 No Content`다 — 추론 실패가 아니라 사실이다.

---

## 2. 실제 결함

### 2.1 애플 가입 닉네임이 항상 기본값이 된다 — 고쳤다

```
mobile/App.tsx:357              full_name: `${givenName} ${familyName}`
backend/accounts/views.py:755   nickname_suggestion = request.data.get('user_name', '')
```

셸은 `full_name`으로 보내고 뷰는 `user_name`을 읽는다. 애플로 가입한 사용자의 닉네임은
항상 기본값 `사용자`가 된다.

**계약이 문서화되지 않아 양쪽 다 자기가 맞다고 믿고 있었던** 종류의 결함이다.
`backend/tests/test_social_login_v2_contract.py`가 현재 동작을 고정하고 있으므로,
고치기로 하면 그 변경이 의도된 것임을 기계가 확인해 준다.

**조치(제품 결정)**: 서버가 **두 이름표를 모두 수용**한다.

```python
nickname_suggestion = (
    request.data.get('user_name') or request.data.get('full_name') or ''
).strip()
```

셸을 고치는 쪽은 앱 배포가 필요하고 OTA 도달이 아직 확인되지 않았다. 서버만 고치면
**구버전 셸도 즉시 혜택**을 보고 앱 배포를 기다릴 필요가 없다.
계약 테스트가 버그 동작을 고정하고 있었으므로 "셸이 보낸 이름이 닉네임이 된다"로 함께
갱신했다 — 의도된 변경임을 기계가 기록한다.

### 2.2 성경 역본 코드가 타입 없이 오갔다 — 고쳤다

백엔드는 13개 역본만 받는데(`ASV COG COGNEW GAE GRK HAN HEB KJV KNT SAE SAENEW WEB WOORI`)
프론트는 `ref('GAE')`라는 임의 문자열을 넘기고 있었다. query 파라미터를 열거형으로 선언하자
**타입체크가 즉시 잡았다**.

`frontend/app/pages/bible/search.vue`에 호출 경계에서 좁히는 가드를 넣었다.
이제 백엔드가 역본 목록을 바꾸면 이 파일이 타입 오류로 알려준다.

**이것이 1단계가 의도한 작동 방식이 실제로 성립한 첫 사례다.**

---

## 3. 매칭 결과

### 3.1 프론트가 부르는데 백엔드에 없는 경로: **0건**

죽은 호출이나 오타가 없다. 치환이 깔끔하게 진행된 이유다.

### 3.2 백엔드에 있는데 프론트가 부르지 않는 라우트: **27건**

정적 grep만으로 "죽은 코드"를 확정할 수 없으므로 **확정하지 않았다.** 성격별로 나누면:

- **모바일 전용 2건** — 셸이 부르므로 죽은 코드가 아니다
- **외부 소비 가능성 있음** — `hasena/sync/`(cron secret), `bible-cache-status`
- **staff ViewSet 액션** — `set_default`, `toggle_active`, `schedules` 등
- **동일 콜백의 별칭** — `reading/`은 미사용이나 별칭 `reading/update/`는 FE 2곳에서 사용
- **나머지** — `personal-record-detail`, `hasena-record-detail`, `plan-progress`,
  `plan-unsubscribe`, `progress-history`, `plan-stats` 등

**3단계(도메인 소유권)의 입력 자료다.** 지우기 전에 각각이 실제로 죽었는지 확인해야 한다.

### 3.3 같은 기능을 다른 경로로 부르는 곳 — 이중 prefix

`backend/config/urls.py:25-26`이 동일 콜백을 두 prefix에 mount한다.

| 소비자 | `/api/v1/auth/` | `/api/v1/accounts/` |
|---|---|---|
| 웹 | 28 | 9 |
| 모바일 | 20 | **0** |

`/auth/`가 사실상 정규다.

**조치**: 웹 호출을 **전부 `/auth/`로 이관**했다(고유 경로 9종 = 실제 호출 17건).
`profile.ts`·`readingSettings.ts`·`social.ts`·`friends.vue`·`MultiPlanCalendar.vue`.
**라우트 자체는 제거하지 않았다** — 제거는 별도 배포 경계에서 한다. 옮기기와 없애기 사이에
경계가 있어야 문제 시 되돌릴 수 있다. 자세한 순서는 `docs/contract-consumers.md` §3.

**그 과정에서 스키마의 정규 방향이 반대였음을 발견해 고쳤다.** `config/openapi.py`가
`profile/`·`follow/` 등 8개 접미사만 `/accounts/`를 정규로 삼는 규칙을 갖고 있어,
**모바일 셸이 유일하게 쓰는 `/auth/` 쪽이 폐기 예정으로 표시**돼 있었다
(`Deprecated compatibility alias. Use /api/v1/accounts/...`). 정규를 `/auth/` 하나로
통일했고 현재 `/auth/` deprecated 0건 · `/accounts/` 49건이다.

방향이 접미사별로 갈리면 **소비자 근거가 아니라 규칙의 우연**이 정규를 정하게 된다.
정규는 "되돌리기가 가장 비싼 소비자가 쓰는 쪽"이어야 한다.

---

## 4. 계약 밖에 남은 것

### 4.1 요청 본문(request body) 추론

drf-spectacular 진단에 **요청 serializer 추론 실패 109건(고유 67건)** 이 남아 있다.
응답과 query는 보강했지만 요청 본문은 이번 범위가 아니었다. 같은 방식으로 보강 가능하다.

### 4.2 프론트 테스트가 소스 텍스트를 고정한다

프론트 테스트 **23개 파일에 288개의 소스 텍스트 정규식 단언**이 있다
(예: `assert.match(source, /const PROVIDERS: Provider\[\] = \['kakao', 'google', 'apple'\]/)`).

이번 치환에서 실제로 깨진 것은 1건뿐이었지만(`api.post` → `api.POST` 표기 변경),
**컴포넌트를 재작성하는 3·4단계에서는 정면으로 부딪친다.** 동작 기반 테스트로 옮기는 작업이
그 단계보다 앞서야 한다.

### 4.3 타입체크 부채 163건

`nuxt typecheck`는 이 작업 이전부터 붉었고(175건), CI는 아예 돌리지 않고 있었다.
즉 **타입 기반 계약을 만들어도 집행할 수단이 없는 상태**였다.

`frontend/scripts/typecheck-ratchet.mjs`로 기준선을 고정하고 **신규 오류만 실패**시키도록 해
`frontend-ci`에 넣었다. 기존 오류를 고치면 기준선을 낮춰야 통과하므로 **부채는 줄기만 하고
늘 수 없다.** 현재 **163건**(치환 과정에서 12건 감소, 시그니처 102종 → 95종).

### 4.4 측정 패턴이 호출 형태 하나를 놓쳤다 — 기록으로 남긴다

치환 진행률을 `api.get(` 패턴으로 세는 동안 **`useApi().get(` 형태 20건이 집계에서
빠져** 있었다. 그래서 한때 "구형 호출 잔여 0건"으로 보고했으나 사실이 아니었다.
정확한 패턴 `(api|useApi\(\))\.(get|post|put|patch|delete)\s*[<(]` 으로 다시 세어
20건을 마저 치환했고, 현재 **전수 0건**이다.

교훈은 숫자가 아니라 방법이다. **한 가지 표기만 세는 grep은 "0건"을 쉽게 만들어낸다.**
같은 개념이 여러 표기로 존재할 수 있는 코드베이스에서는, 진행률을 보고하기 전에
**세는 패턴 자체를 반증**해 봐야 한다.
