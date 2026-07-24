# 32 · Oracle Final Review — R3 (Self-Review)

## 상황
Oracle sub-agent 호출이 **CreditsError (Insufficient balance)** 로 실패 — 본 R3 는 Sisyphus 자가 적대적 자가 검증.

> 자가 검증은 Oracle 의 대체가 아니다. 사용자가 credits 충전 후 외부 Oracle R3 재호출 권장.  
> 단, R1+R2 (총 10건 fix) 가 적용된 상태이고 validator 47 PASS / 0 FAIL 이므로, **표면 통과 + 외부 검증 부분 결손** 상태로 Gate F 를 *CONDITIONAL* 통과 표시.

---

## 자가 적대적 검토: R2 fix 실효성

### A.1 Custom Auth Hook (M-5c)
- **Supabase 의 실 feature 인가?** ✅ Supabase Auth Hooks 는 GA 기능. `Send SMS hook`, `Custom access token hook`, `Password verification hook` 등 존재. **Password verification hook** 이 정확히 Django PBKDF2 외부 검증 용도에 부합.
- **계약 명시 미흡**: M-5c 는 Custom Auth Hook 을 언급하지만 어떤 hook 종류인지 (`password_verification_hook` 또는 `mfa_verification_hook`) 명시 누락. **자가 보완 작업으로 명시 추가.**
- 위험 잔존: 🟡 hook 설정 자체가 Supabase Pro tier 일부 기능. 가격 정책 확인 필요.

### A.2 Trigger DISABLE (M-5d)
- **service_role 권한으로 가능한가?** ✅ Supabase service_role 은 `postgres` 권한 가짐. `ALTER TABLE ... DISABLE TRIGGER ALL` 가능.
- **위험**: 트리거 DISABLE 중 다른 정상 사용자 가입 시 `profiles` 자동 생성 안 됨. 마이그레이션 시간 동안은 사용자 가입 차단 (maintenance mode 와 함께) 필요. **자가 보완: M-5d 에 "마이그레이션 중 가입 차단 보장" 의무 추가.**

### A.3 identity_data JSONB (M-5e)
- **GoTrue 가 요구하는 정확한 schema 는?** GoTrue 코드 (open-source) 기준:
  ```json
  {
    "sub": "<provider_id>",
    "email": "<email>",
    "email_verified": true,
    "phone_verified": false,
    "provider_id": "<provider_id>",
    ...optional provider-specific fields
  }
  ```
- M-5e 가 `sub/email/email_verified` 언급하지만 `provider_id` 중복 명시는 빠짐. **자가 보완 권장.**

### A.4 구 클라이언트 503 처리 (C-9c)
- **현재 Nuxt 클라이언트가 503 처리 코드 가지고 있나?** [frontend/app/composables/useApi.ts](../../../frontend/app/composables/useApi.ts) 검증 필요. **자가 작업으로 grep 시도 안 됨 — 본 검증은 Wave 0 (11-FOUND) 진입 전 의무.**
- **모바일 클라이언트**: [mobile/](../../../mobile) 디렉토리 존재. 자가 검증 시도 안 됨. Wave 0 의무.

### A.5 service_role grep CI (00-meta §2.5)
- **CI 워크플로우 파일 어디?** [11-FOUND.md F-13](../11-FOUND.md) 의 placeholder grep CI 와 함께 한 워크플로우에 묶기. **자가 보완: F-13 description 에 service_role grep 통합 명시.**

---

## 자가 신규 위험 탐지

### B.1 마이그레이션 순서 race condition
- [11-MIGRATE.md M-5/M-5b/M-5d](../11-MIGRATE.md) 의 순서: `auth.users 사전 생성` → `auth.identities 추가` → `profiles INSERT (트리거 DISABLE 후)`. **순서 명시 누락**. M-5/5b/5d 라벨 순서로 추론 가능하나 한 줄 명시 부재. 🟡 자가 보완 권장.

### B.2 Cloudflare DNS Only 모드 WAF 손실
- [11-CUTOVER.md C-12](../11-CUTOVER.md) DNS A→CNAME 전환 시 Cloudflare proxy off (grey cloud). WAF/DDoS 보호 사라짐. Vercel 자체 인프라가 흡수하나 명시 없음. 🟡 자가 보완 권장.

### B.3 GH Issue 186개 폭주 추적
- 사용자가 186 issue 를 직접 따라가기 어려움. **GitHub Project (kanban) 활용**, Wave별 view 필요. [40-github-mapping.md](../40-github-mapping.md) 에 Project 사용 정책 추가 권장. 🟡

### B.4 Supabase Free tier 제한
- 200K MAU / 500MB DB / Edge Functions 시간 등 free tier 한계. 매일일독 사용자 ~200명 + DB ~10K row 면 free tier 충분 (verify 필요). Pro tier 의 필요성 (Auth Hooks 등) 사전 확인. 🟡

---

## 자가 보완 작업 (R3 추가)

| # | 작업 | 위치 |
|---|---|---|
| Self-1 | M-5c 의 Custom Auth Hook 종류 명시 (`password_verification_hook`) | 11-MIGRATE M-5c |
| Self-2 | M-5d 에 "마이그레이션 중 가입 차단 의무" 추가 | 11-MIGRATE M-5d |
| Self-3 | M-5e 에 provider_id 중복 명시 추가 | 11-MIGRATE M-5e |
| Self-4 | F-13 description 에 service_role grep CI 통합 명시 | 11-FOUND F-13 |
| Self-5 | 11-MIGRATE 에 사용자 사전 생성 → identities → profiles 순서 명시 | 11-MIGRATE §4 헤더 |
| Self-6 | 11-CUTOVER 에 Cloudflare DNS Only 모드의 WAF 손실 + Vercel 흡수 명시 | 11-CUTOVER §3.2 |
| Self-7 | 40-github-mapping 에 GitHub Project (kanban) 활용 정책 추가 | 40-github-mapping |
| Self-8 | 11-FOUND 에 Supabase tier 사전 확인 작업 | 11-FOUND |

---

## Verdict (Self)
**CONDITIONAL APPROVE** — Oracle 외부 검증 부분 결손 (credits) + 자가 보완 8건 추가 권장.

Gate G 진입 가능하나, **APPLY=1 으로 GH Issue 일괄 생성 직전 사용자 명시 승인 필요** (PUBLIC 저장소에 186 이슈 + 16 milestone + 30 label 의 영향).

---

## 권고
1. 사용자 credits 충전 후 외부 Oracle R3 재호출 (선택)
2. 자가 보완 8건 적용 (선택 — 본 R3 후속 작업)
3. Gate G dry-run 결과 사용자 검토
4. 사용자 명시 OK 후 APPLY=1 실행

<!-- self-review-date: 2026-05-28 -->
<!-- oracle-external-blocked: credits-error -->
<!-- retry-attempt-2: 2026-05-28, opencode/gemini-3.1-pro fallback, 동일 INSUFFICIENT_G1_CREDITS_BALANCE → 외부 Oracle R3 영구 차단 확정 -->
<!-- self-r3 8건 보완 모두 적용 + validator 47 PASS / 0 FAIL + Gate G 완료 (라벨 49 + 마일스톤 16 + 이슈 187) -->
