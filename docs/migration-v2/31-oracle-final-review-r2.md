# Oracle Final Review R2 (Migration v2)

**Essential**
**Bottom Line**: 
REJECT. R1 픽스 중 PBKDF2 해시 변환은 GoTrue 암호화 라이브러리 미지원으로 인해 치명적 실패를 유발합니다. 또한 `auth.users`와 `profiles` 간의 DB 트리거 충돌로 인해 마이그레이션 스크립트가 붕괴하는 신규 BLOCKING 위험이 발견되었습니다.

**Action Plan**:
1. **PBKDF2 전환 폐기 (Critical)**: Supabase GoTrue는 Django의 `pbkdf2_sha256`를 네이티브 지원하지 않습니다. Custom Auth Hook을 통한 외부 검증 로직을 구축하거나, 이메일 사용자 전원에게 비밀번호 재설정을 강제하는 정책으로 선회하십시오.
2. **Trigger 충돌 우회 (Critical)**: `auth.users` INSERT 시 발동되는 `profiles` 자동 생성 트리거로 인해 중복 키 에러가 발생합니다. 마이그레이션 중 트리거를 일시 중지(`ALTER TABLE ... DISABLE TRIGGER ALL;`)하거나, `profiles` 이관 시 `ON CONFLICT DO UPDATE`를 적용하십시오.
3. **`identity_data` 규격화 (Major)**: `auth.identities` INSERT 시 `provider`와 `provider_id`뿐만 아니라, GoTrue가 파싱하는 필수 규격인 `identity_data` JSONB(`sub`, `email` 등 포함)를 완벽히 구성해야 합니다.
4. **구버전 클라이언트 검증 (Major)**: 현재 배포 중인 구 Nuxt/모바일 앱 내부에 503 JSON(`app_updated`) 응답을 처리하여 앱스토어로 유도하는 로직이 **실제로 존재하는지** 역검증하십시오.
5. **Service Role 유출 차단 (Major)**: 실수에 의한 전체 DB 접근 권한 유출을 막기 위해, CI에 `NEXT_PUBLIC_.*SERVICE_ROLE_KEY` 패턴을 검출해 Hard Fail 처리하는 스크립트를 추가하십시오.

**Effort estimate**: Medium (1-2d)

**Expanded**
**Why this approach**:
- 지원하지 않는 해시 포맷을 주입할 경우, 데이터 이관 검증(T-0)은 통과하지만 컷오버 직후 실제 사용자의 로그인이 100% 실패하는 Silent Fail이 발생합니다.
- Supabase 생태계 표준인 `on_auth_user_created` 트리거를 고려하지 않은 상태에서 `profiles`를 맹목적으로 INSERT하면 Unique Constraint 위반으로 파이프라인이 즉각 중단됩니다.

**Watch out for**:
- **Cloudflare 보호 해제 (B.3)**: Vercel CNAME 연결로 DNS Only(Grey Cloud) 모드가 적용되면 기존 Cloudflare WAF/DDoS 보호가 해제됩니다.
- **GitHub Issue 폭주 (B.5)**: 183개의 이슈 대량 자동 생성은 Rate Limit 및 추적 불가를 유발하므로 Milestone과 대분류 단위 생성으로 응축을 권장합니다.
