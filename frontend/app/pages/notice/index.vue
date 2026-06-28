<template>
  <PageLayout title="공지사항" fallback-path="/">
    <div class="content-section fade-in" style="animation-delay: 0.2s">
      <div class="notice-item">
        <div class="notice-date">2025년 03월 01일</div>
        <div class="notice-header">
          <span class="new-badge">NEW</span>
          <h2 class="notice-title">푸른통독 지원</h2>
        </div>
        <div class="notice-content">
          <div class="notice-summary">
            <p>매일일독이 더욱 다양한 성경통독 플랜을 지원해요.<br>이제 청년부 푸른통독도 매일일독에서 함께 관리할 수 있어요.</p>
          </div>
          <div class="notice-highlights">
            <div class="highlight-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>여러 플랜을 동시에 구독하고 진행할 수 있어요</span>
            </div>
            <div class="highlight-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>각 플랜별로 진도와 통계를 별도 관리해요</span>
            </div>
            <div class="highlight-item">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
              <span>교역자를 위한 총회 목회달력도 지원 예정이예요 </span>
            </div>
          </div>
          <div class="notice-action">
            <button class="action-button" @click="navigateToNoticeDetail('plan-update')">
              자세히 보기
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="notice-item">
        <div class="notice-date">2025년 02월 27일</div>
        <div class="notice-header">
          <h2 class="notice-title">매일일독 앱 설치 안내</h2>
        </div>
        <div class="notice-content">
          <p>매일일독을 앱처럼 사용할 수 있는 방법을 알려드려요.</p>
          <div class="notice-action">
            <button class="action-button" @click="navigateToInstall">
              설치 방법 보기
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round"
                  stroke-linejoin="round" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      <div class="notice-item">
        <div class="notice-date">2025년 02월 24일</div>
        <div class="notice-header">
          <h2 class="notice-title">매일일독 서비스 시작</h2>
        </div>
        <div class="notice-content">
          <p>매일일독 서비스가 출시되었어요. 성경 통독을 더 편리하게 진행하실 수 있도록 최선을 다해 도와드릴게요.</p>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup>
import { useRouter } from 'vue-router'
import PageLayout from '~/components/common/PageLayout.vue'

const router = useRouter()

const navigateToInstall = () => {
  router.push('/install')
}

const navigateToNoticeDetail = (path) => {
  router.push(`/notice/${path}`)
}
</script>

<style scoped>
.back-button {
  background: none;
  border: none;
  padding: 0.375rem;
  margin: -0.375rem;
  margin-right: 0.5rem;
  color: var(--text-primary);
  cursor: pointer;
}

.content-section {
  margin: 0.75rem;
  border-radius: 16px;
}

.notice-item {
  padding-bottom: 1.5rem;
  margin-bottom: 1.5rem;
  border-bottom: 1px solid var(--color-border-light);
}

.notice-date {
  font-size: 0.8rem;
  color: var(--color-text-tertiary);
}

.notice-content {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
}

.notice-action {
  margin-top: 1rem;
  display: flex;
  justify-content: flex-end;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.fade-in {
  opacity: 0;
  animation: fadeIn 0.4s ease-out forwards;
}

.notice-header {
  display: flex;
  align-items: center;
  justify-content: start;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.notice-date {
  font-size: 0.85rem;
  color: var(--color-text-tertiary);
}

.new-badge {
  background: var(--color-error);
  color: var(--color-text-inverse);
  font-size: 0.6rem;
  font-weight: 600;
  padding: 0.1rem 0.3rem;
  border-radius: 4px;
}

.notice-item {
  background: var(--color-bg-card);
  border-radius: 16px;
  padding: 1.5rem;
  margin-bottom: 1rem;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.05);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.notice-item:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
}

.notice-title {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
}

.notice-summary {
  font-size: 0.95rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
  margin-bottom: 1.25rem;
}

.notice-highlights {
  background: var(--color-bg-tertiary);
  border-radius: 12px;
  padding: 0.75rem 1rem;
  margin-bottom: 1.25rem;
}

.highlight-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0;
  color: #4B5563;
  font-size: 0.9rem;
}

.highlight-item svg {
  flex-shrink: 0;
  color: var(--primary-color);
}

.action-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.75rem 1.25rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 0.95rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
  width: 100%;
  justify-content: center;
}

.action-button:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
}

@keyframes pulse {
  0% {
    transform: scale(1);
  }

  50% {
    transform: scale(1.05);
  }

  100% {
    transform: scale(1);
  }
}

.fade-in {
  opacity: 0;
  animation: fadeIn 0.4s ease-out forwards;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(10px);
  }

  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
