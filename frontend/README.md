# Maeil1Dok Frontend

프로덕션 웹 애플리케이션입니다. Nuxt 4 SSR, Vue, Pinia, Tailwind를 사용하며 OCI에서 컨테이너로 실행됩니다.

## 실행

```bash
npm ci
npm run dev
```

## 검증

```bash
npm test
npm run build
```

프로덕션 빌드 실행:

```bash
npm run start
```

## 설정

- 로컬 환경 변수 예시: [`.env.example`](.env.example)
- 프로덕션 환경 변수: VM의 `.env.frontend.oci`에만 저장
- API 주소: `NUXT_PUBLIC_API_BASE`, `NUXT_INTERNAL_API_BASE`
- 시크릿과 실제 운영 값은 커밋 금지

공통 개발 규칙은 [`../AGENTS.md`](../AGENTS.md), UI 규칙은 [`../DESIGN.md`](../DESIGN.md), 배포 절차는 [`../DEPLOY.md`](../DEPLOY.md)를 따릅니다.