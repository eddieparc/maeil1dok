<template>
  <PageLayout title="공지사항" fallback-path="/notice">
    <div class="content-section fade-in" style="animation-delay: 0.2s">
      <div class="notice-content">
        <h2>매일일독이 드디어 푸른통독을 지원해요 🎉</h2>
        
        <section class="update-section">
          <ul class="feature-list">
            <li>
              <strong>플랜 선택 기능</strong>
              <p>다양한 성경통독 플랜 중에서 나에게 맞는 플랜을 선택할 수 있습니다.</p>
            </li>
            <li>
              <strong>플랜별 진도 관리</strong>
              <p>이제 각 플랜별로 독립적인 진도 관리가 가능해요. 여러 플랜을 동시에 구독하고 진행할 수 있습니다.</p>
            </li>
            <li>
              <strong>플랜별 통계</strong>
              <p>각 플랜의 전체 진행률과 개인 진행률을 별도로 확인할 수 있습니다.</p>
            </li>
          </ul>
        </section>

        <section class="guide-section">
          <h3>푸른통독 시즌1 구독 방법</h3>
          <ol class="step-list">
            <li>하단 '플랜 관리로 이동' 버튼 클릭</li>
            <li>푸른통독 시즌1 구독하기(로그인 필요)</li>
            <li>메인 화면에서 플랜 선택</li>
          </ol>
        </section>

        <div class="action-buttons">
          <button @click="navigateToPlans" class="primary-button">
            플랜 관리로 이동
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M9 6L15 12L9 18" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </div>
  </PageLayout>
</template>

<script setup>
import { useRouter } from 'vue-router'
import PageLayout from '~/components/common/PageLayout.vue'

const router = useRouter()

const navigateToPlans = () => {
  router.push('/plans')
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
  background: white;
  margin: 0.75rem;
  padding: 1.5rem;
  border-radius: 16px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.notice-content h2 {
  font-size: 1.25rem;
  font-weight: 700;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.update-section, .guide-section {
  margin-bottom: 2rem;
}

h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin-bottom: 1rem;
}

.feature-list, .step-list {
  list-style: none;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 1.25rem;
}

.feature-list li {
  background: var(--color-bg-tertiary);
  padding: 1.25rem;
  border-radius: 12px;
  border: 1px solid var(--color-border-light);
}

.feature-list li strong {
  display: block;
  font-size: 1rem;
  color: var(--primary-color);
  margin-bottom: 0.5rem;
}

.feature-list li p {
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.5;
  margin: 0;
}

.step-list {
  counter-reset: step;
  padding-left: 2rem;
}

.step-list li {
  position: relative;
  padding-left: 1rem;
  font-size: 0.95rem;
  color: var(--text-secondary);
  line-height: 1.5;
}

.step-list li::before {
  counter-increment: step;
  content: counter(step);
  position: absolute;
  left: -2rem;
  width: 1.5rem;
  height: 1.5rem;
  background: var(--primary-light);
  color: var(--primary-color);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 0.8rem;
  font-weight: 600;
}

.action-buttons {
  margin-top: 2rem;
  display: flex;
  justify-content: center;
}

.primary-button {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.875rem 1.5rem;
  background: var(--primary-color);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.2s ease;
}

.primary-button:hover {
  background: var(--primary-dark);
  transform: translateY(-1px);
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
</style>
