# Maeil1Dok v2

Next.js와 Supabase 기반의 차기 버전입니다. 현재 개발 중이며 프로덕션에는 배포되지 않았습니다.

## 실행

```bash
npm ci
cp .env.local.example .env.local
npm run dev
```

## 검증

```bash
npm test
npm run lint
npm run build
```

추가 명령:

```bash
npm run test:e2e
npm run storybook
```

## 문서

- 전환 계획과 기능 매트릭스: [`../docs/migration-v2/README.md`](../docs/migration-v2/README.md)
- 데이터 마이그레이션: [`scripts/migrate/RUNBOOK.md`](scripts/migrate/RUNBOOK.md)
- Vercel 설정: [`docs/vercel-setup.md`](docs/vercel-setup.md)

실제 `.env.local`, Supabase service-role key, 마이그레이션 추출 데이터는 커밋하지 않습니다.