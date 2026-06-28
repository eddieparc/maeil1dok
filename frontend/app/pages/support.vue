<template>
  <PageLayout title="고객지원" fallback-path="/">
    <div class="legal-page">
      <div class="bg-pattern"></div>
      <main class="main-content">
        <div class="card fade-in" style="animation-delay: 0.1s">
          <h1 class="page-title">Customer Support</h1>
          <p class="page-subtitle">고객지원</p>

          <div class="support-content">
            <p class="support-description">
              매일일독 서비스 이용 중 궁금한 점이나 불편한 점이 있으시면 
              언제든지 문의해 주세요. 빠르게 답변 드리겠습니다.
            </p>

            <div class="contact-section">
              <div class="contact-item">
                <span class="contact-icon">
                  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <rect width="20" height="16" x="2" y="4" rx="2"/>
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
                  </svg>
                </span>
                <div class="contact-info">
                  <span class="contact-label">Email</span>
                  <span class="contact-value">support@maeil1dok.app</span>
                </div>
              </div>
            </div>

            <a 
              href="mailto:support@maeil1dok.app" 
              class="email-button"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect width="20" height="16" x="2" y="4" rx="2"/>
                <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
              </svg>
              이메일 보내기
            </a>

            <div class="support-note">
              <p>
                <strong>운영 시간:</strong> 평일 09:00 - 18:00<br>
                <small>주말 및 공휴일에는 답변이 지연될 수 있습니다.</small>
              </p>
            </div>
          </div>
        </div>

        <div class="link-section fade-in" style="animation-delay: 0.2s">
          <NuxtLink to="/company" class="link-button">회사정보</NuxtLink>
          <NuxtLink to="/privacy" class="link-button">개인정보처리방침</NuxtLink>
          <NuxtLink to="/terms" class="link-button">이용약관</NuxtLink>
          <NuxtLink to="/" class="link-button">홈으로</NuxtLink>
        </div>
      </main>
    </div>
  </PageLayout>
</template>

<script setup>
import { useHead } from '#imports'
import PageLayout from '~/components/common/PageLayout.vue'

useHead({
  title: '고객지원 - 매일일독',
  meta: [
    { name: 'description', content: '매일일독 고객지원 페이지입니다. 서비스 이용 중 궁금한 점이나 불편한 점이 있으시면 언제든지 문의해 주세요.' },
    { property: 'og:title', content: '고객지원 - 매일일독' },
    { property: 'og:description', content: '매일일독 고객지원 페이지입니다. 서비스 이용 중 궁금한 점이나 불편한 점이 있으시면 언제든지 문의해 주세요.' },
    { property: 'og:url', content: 'https://maeil1dok.app/support' },
    { property: 'og:type', content: 'website' },
  ],
})
</script>

<style scoped>
.legal-page {
  font-family: 'Pretendard', sans-serif;
  background-color: var(--color-bg-primary);
  color: var(--color-text-primary);
  min-height: 100vh;
  position: relative;
  -webkit-font-smoothing: antialiased;
}

.bg-pattern {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-image: radial-gradient(var(--color-text-tertiary) 1px, transparent 1px);
  background-size: 32px 32px;
  opacity: 0.1;
  z-index: 0;
  pointer-events: none;
}

.main-content {
  padding: 1.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.card {
  background: var(--color-bg-card);
  border-radius: 20px;
  box-shadow: var(--shadow-md);
  overflow: hidden;
  border: 1px solid var(--color-border-light);
  padding: 2rem;
}

.page-title {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--color-text-primary);
  margin: 0 0 0.25rem 0;
}

.page-subtitle {
  font-size: 0.95rem;
  color: var(--color-text-secondary);
  margin: 0 0 2rem 0;
}

.support-content {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.support-description {
  font-size: 1rem;
  color: var(--color-text-secondary);
  line-height: 1.7;
  margin: 0;
}

.contact-section {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.contact-item {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--color-bg-tertiary);
  border-radius: 12px;
  border: 1px solid var(--color-border-light);
}

.contact-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  background: var(--color-accent-primary);
  color: white;
  border-radius: 12px;
  flex-shrink: 0;
}

.contact-info {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.contact-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.contact-value {
  font-size: 1rem;
  color: var(--color-text-primary);
  font-weight: 500;
}

.email-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 1rem 2rem;
  background: var(--color-accent-primary);
  color: white;
  border: none;
  border-radius: 12px;
  font-size: 1rem;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.2s ease;
  cursor: pointer;
}

.email-button:hover {
  background: var(--color-accent-hover);
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.email-button:active {
  transform: translateY(0);
}

.support-note {
  padding: 1rem;
  background: var(--color-bg-tertiary);
  border-radius: 12px;
  border-left: 4px solid var(--color-accent-primary);
}

.support-note p {
  margin: 0;
  font-size: 0.9rem;
  color: var(--color-text-secondary);
  line-height: 1.6;
}

.support-note small {
  color: var(--color-text-tertiary);
}

.link-section {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  justify-content: center;
}

.link-button {
  padding: 0.6rem 1.25rem;
  background: var(--color-bg-tertiary);
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border-default);
  border-radius: 99px;
  font-size: 0.9rem;
  font-weight: 500;
  text-decoration: none;
  transition: all 0.2s ease;
}

.link-button:hover {
  background: var(--color-bg-hover);
  color: var(--color-text-primary);
  border-color: var(--color-border-dark);
}

/* Animations */
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.fade-in {
  opacity: 0;
  animation: fadeIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
}
</style>
