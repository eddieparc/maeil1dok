# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

매일일독 (Maeil1Dok) is a Bible reading tracking application. It helps users systematically complete Bible reading with a structured reading schedule.

## Tech Stack

**Backend:**
- Django 4.2+ with Django REST Framework
- MySQL 8.0 database
- JWT authentication (djangorestframework-simplejwt)
- OAuth2 integration (Kakao, Google)

**Frontend:**
- Nuxt 3 with Vue 3
- Pinia for state management  
- Tailwind CSS for styling
- Axios for API calls

**Infrastructure (production):**
- OCI single VM + Cloudflare Tunnel (no inbound ports; co-located with urban-blanks — never share networks/ports)
- 7 containers via `docker-compose.oci.yml`: web(Django), frontend(Nuxt SSR), celery-worker, celery-beat(x1), mysql 8, redis, cloudflared
- CI/CD: GitHub Actions — quality gates (backend tests on real MySQL 8) → auto deploy (`deploy-oci`) → live smoke
- See **DEPLOY.md** for the full deployment guide (env/secrets, backup, rollback, troubleshooting)

## Development Commands

### Frontend (in `/frontend` directory)
```bash
# Install dependencies
npm install

# Development server (http://localhost:3000)
npm run dev

# Build for production
npm run build

# Preview production build
npm run preview

# Start production server
npm run start
```

### Backend (in `/backend` directory)
```bash
# Run migrations
python manage.py migrate

# Create superuser
python manage.py createsuperuser

# Run development server
python manage.py runserver

# Run tests
python manage.py test
```

### Docker Compose (local development only — production deploys via DEPLOY.md)
```bash
# Start all services
docker-compose up

# Start in background
docker-compose up -d

# Stop all services
docker-compose down

# Rebuild containers
docker-compose build
```

## Architecture

### Backend Structure
- `accounts/` - User authentication and profile management
- `todos/` - Bible reading schedule and progress tracking
- `config/` - Django settings and root URL configuration
- API endpoints are versioned under `/api/v1/`

### Frontend Structure
- `pages/` - Nuxt page components with file-based routing
  - `auth/` - Authentication related pages
  - `admin/` - Admin functionality
  - `reading.vue` - Main reading tracking interface
- `components/` - Reusable Vue components
- `stores/` - Pinia state management stores
- `composables/` - Vue composition functions
- `server/middleware/` - Server-side middleware (proxy)

### Key Features
- Bible reading schedule management (`DailyBibleSchedule` model)
- User progress tracking (`UserBibleProgress` model)
- Multiple reading plans support (`BibleReadingPlan` model)
- Social login integration (Kakao, Google OAuth)
- PWA support (in development)

## Environment Configuration

Required environment variables:
- Backend: `SECRET_KEY`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`, `DB_HOST`
- Frontend: `KAKAO_CLIENT_ID`, `KAKAO_JS_KEY`, `GOOGLE_CLIENT_ID`, API endpoints

## API Structure

Main API endpoints:
- `/api/v1/auth/` - Authentication (login, token refresh)
- `/api/v1/todos/` - Bible reading schedules and progress
- `/api/v1/accounts/` - User profile management

## Database Models

Key models:
- `User` - Custom user model with nickname and profile image
- `DailyBibleSchedule` - Daily Bible reading assignments
- `UserBibleProgress` - Tracks user's reading completion
- `BibleReadingPlan` - Different reading plan options
- `PlanSubscription` - User's plan subscriptions

## UI Component Guidelines

### Modal (통합 모달 시스템)

모든 모달은 통합 모달 시스템을 사용합니다. 개별 모달 컴포넌트를 직접 구현하지 마세요.

**사용 방법:**
```typescript
import { useModal } from '~/composables/useModal';

const modal = useModal();

// Confirm 모달 (확인/취소)
const confirmed = await modal.confirm({
  title: '제목',
  description: '설명 텍스트',
  confirmText: '확인',    // optional, default: '확인'
  cancelText: '취소',     // optional, default: '취소'
  confirmVariant: 'danger', // optional: 'primary' | 'danger'
  icon: 'warning'         // optional: 'warning' | 'error' | 'info' | 'success'
});

// Alert 모달 (확인만)
await modal.alert({
  title: '제목',
  description: '설명 텍스트',
  confirmText: '확인',    // optional
  icon: 'info'            // optional
});
```

**컴포넌트 위치:**
- `components/ui/modal/ModalHost.vue` - 모달 호스트 (app.vue에 배치)
- `components/ui/modal/ModalContainer.vue` - 모달 컨테이너
- `components/ui/modal/ConfirmModal.vue` - 확인 모달
- `components/ui/modal/AlertModal.vue` - 알림 모달
- `composables/useModal.ts` - 모달 composable
- `composables/useModalState.ts` - 모달 상태 관리