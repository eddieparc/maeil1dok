# 베타 프론트엔드 배포 (LAB-124, LAB-126)

> Historical production-backed baseline only. For LAB-127 isolated beta, use
> [beta-isolated-deployment.md](beta-isolated-deployment.md). Do not execute the
> legacy deploy/rollback commands below for isolation. The replacement config
> is not evidence of a completed cutover.

- 주소: https://beta.maeil1dok.app
- 소스: `lab-126-beta-auth-loading` (`lab-124-design-refresh` 후속), `frontend/`
- VM: `ubuntu@168.107.46.120`, `/opt/maeil1dok-beta`
- Compose: `docker-compose.beta.yml`, 프로젝트 `maeil1dok-beta`
- 터널 대상: `http://frontend-beta:3000` (`maeil1dok_default` 네트워크)
- DNS: 프록시된 CNAME `beta` → `60dbaac7-8876-449c-a1d5-9268e870aace.cfargotunnel.com`

운영 프론트엔드 이미지·서비스와 별도로 빌드한다. 호스트 포트를 열거나 다른 서비스의
네트워크를 공유하지 않는다. 기존 VM을 사용하며 새 클라우드 자원을 만들지 않는다.
베타에서는 Sentry 전송을 끄고 공개 산출물에서 소스맵을 제거한다.

## LAB-126 진행 상태 (2026-09-06)

- 운영 API에는 베타 콜백 검증·코드 교환 지원을 반영했다. 운영 프론트와 최신 오디오 코드는 유지했다.
- Google·Kakao·Apple의 베타 콜백은 콘솔 저장 및 재조회를 확인했다.
  Apple에는 `beta.maeil1dok.app` 도메인도 추가했으며 기존 항목은 유지했다.
- 새 프론트 이미지로 **실행 컨테이너 전환을 완료**하고 health 정상 응답을 확인했다.
  - 현재 실행 이미지: `sha256:72ba1ba174dbca4e6c21a2694a5d4840ff4e5fff0832cf3122c88944dfe8b78a`
  - `builtAt`: `2026-09-06T13:00:46.650Z`
  - 이전 이미지는 `maeil1dok-frontend-beta:before-lab126`으로 보존했다.
- 이미지는 미커밋 작업 트리에서 빌드했다. 빌드 마커의 `commit`은 기반 SHA이므로
  배포본을 식별할 때 위 이미지 digest와 `builtAt`을 함께 사용한다.
- 인증 복원 전에 보호 데이터를 guest/error/empty로 확정하던 초기 조회를 수정했다.
  친구·하세나 통계·개인 순위·관리자 요약도 복원 후 권한을 판정한다.
- 검증: 프론트 290개 통과, 타입 기준선 154(신규 0), 프로덕션 빌드·컨테이너 health 정상.
  회원·SNS·OpenAPI·Redis 219개는 앞선 API 수정 단계에서 통과했다.
  전체 백엔드 1,073개 실행에는 이번 변경과 무관한 하세나 동시성 테스트 1개의 간헐적 실패가 있다.
- Aside의 기존 로그인으로 알림·알림 설정·플랜·읽기 이력·북마크·노트·하이라이트를 검증했다.
  실제 GET을 지연한 동안 스켈레톤을 유지했고, 해제 후 200 응답과 데이터/빈 목록으로 전환했다.
  알림·플랜은 390/1280px, 나머지는 390px에서 DOM 가로 넘침이 없었다.
- 최종 배포 후 친구 목록·하세나 본문·순위도 같은 지연/해제 검증을 통과했다.
  하세나 개인 통계와 내 순위의 후속 요청도 각각 200으로 완료됐다.
  현재 계정은 관리자가 아니므로 관리자 화면은 접근 제한까지만 확인했다.
  복원된 관리자 계정의 최초 조회는 실행형 회귀 테스트로 검증했다.
- 스켈레톤의 상태 전환·모션 감소와 390px 넘침 수정은 DOM으로 확인했다.
  밝은 테마 13종 개별 캡처와 정상 데스크톱 알림 화면은 검토했다.
  Aside의 뷰포트 반복·빈 다크 캡처는 증거에서 제외했으며, 전체 반응형·다크 시각 검증 완료를 주장하지 않는다.
  기존 계정 설정 SSR 테스트 픽스처의 렌더 경고와 LSP 데몬 장애는 남아 있다.

## 배포

프론트엔드 테스트·타입 래칫·빌드를 먼저 통과시킨다. `frontend/`와
`docker-compose.beta.yml`을 VM의 베타 디렉터리에 전송한다.
`node_modules`, `.nuxt`, `.output`, `.env*`는 전송하지 않는다.

VM에서 배포할 소스의 전체 Git SHA를 `COMMIT_SHA`에 설정하고 실행한다.

```bash
cd /opt/maeil1dok-beta
docker compose -f docker-compose.beta.yml --env-file /opt/maeil1dok/.env.oci config --quiet
docker compose -f docker-compose.beta.yml --env-file /opt/maeil1dok/.env.oci build
docker compose -f docker-compose.beta.yml --env-file /opt/maeil1dok/.env.oci up -d --wait
curl -fsS https://beta.maeil1dok.app/api/health
curl -fsS https://beta.maeil1dok.app/_build-marker.json
```

`/_build-marker.json`의 `commit`이 배포한 SHA와 같아야 한다.
Aside에서 홈·성경·로그인·그룹 화면을 열고 클라이언트 탐색과 API 응답을 확인한다.

## API와 로그인

베타는 **운영 API·회원·데이터를 공유**한다. 별도 샌드박스가 아니므로 읽음 체크 등
사용자의 변경은 실제 데이터에 반영된다.
운영 `.env.oci`의 `CORS_ALLOWED_ORIGINS`, `CSRF_TRUSTED_ORIGINS`에
`https://beta.maeil1dok.app`을 추가했다. 기존 원본은 유지한다.

OAuth 클라이언트는 운영 설정을 공유하지만 콜백은 베타 전용 주소를 사용한다.
각 제공자 콘솔에서 기존 운영 콜백을 유지한 채 다음 주소를 추가해야 한다.

| 제공자 | 베타 콜백 |
|---|---|
| Kakao | `https://beta.maeil1dok.app/auth/kakao/callback` |
| Google | `https://beta.maeil1dok.app/auth/google/callback` |
| Apple | `https://beta.maeil1dok.app/auth/apple/callback` |

인증 코드 교환에서도 인가 요청과 동일한 콜백을 사용해야 한다.
회원 쿠키는 `.maeil1dok.app`에서 공유한다.

## 터널과 복구

VM `/mnt/data/maeil1dok/cloudflared/config.yml`의 마지막 404 규칙 앞에
베타 hostname 규칙을 둔다. 운영 `api`·루트·`www` 규칙은 유지한다.
설정을 바꾼 뒤 ingress 검증을 통과시키고 매일일독 cloudflared만 재시작한다.

베타만 중단하려면 베타 디렉터리에서 같은 Compose 명령에 `stop frontend-beta`를 쓴다.
운영 Compose 전체를 내리지 않는다. 이전 베타 이미지가 있으면 해당 SHA를 설정하고
`up -d --no-build --wait`로 되돌린다.
