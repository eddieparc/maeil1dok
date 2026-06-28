<template>
  <PageLayout title="회사정보" fallback-path="/">
    <div class="legal-page">
      <div class="bg-pattern"></div>
      <main class="main-content">
        <div class="card fade-in" style="animation-delay: 0.1s">
          <h1 class="page-title">Company Info</h1>
          <p class="page-subtitle">회사정보</p>

          <div class="info-grid">
            <div class="info-item">
              <span class="info-label">Company Name</span>
              <span class="info-value">제이지피랩스</span>
            </div>
            <div class="info-item">
              <span class="info-label">Representative</span>
              <span class="info-value">박지건</span>
            </div>
            <div class="info-item">
              <span class="info-label">Business Registration No.</span>
              <span class="info-value">613-24-62749</span>
            </div>
            <div class="info-item">
              <span class="info-label">Mail-Order Sales No.</span>
              <span class="info-value">제 2022-용인기흥-1517 호</span>
            </div>
            <div class="info-item">
              <span class="info-label">Address</span>
              <span class="info-value">경기도 용인시 기흥구 동백4로 6, 6105호</span>
            </div>
            <div class="info-item">
              <span class="info-label">Phone</span>
              <span class="info-value">010-2368-9677</span>
            </div>
            <div class="info-item">
              <span class="info-label">Email</span>
              <span class="info-value">support@maeil1dok.app</span>
            </div>
            <div class="info-item">
              <span class="info-label">Privacy Officer</span>
              <span class="info-value">박지건</span>
            </div>
            <div class="info-item">
              <span class="info-label">Business Verification</span>
              <span class="info-value">
                <a 
                  href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=6132462749" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  class="external-link"
                >
                  사업자정보확인 &rarr;
                </a>
              </span>
            </div>
            <div class="info-item">
              <span class="info-label">Hosting Provider</span>
              <span class="info-value">Vercel Inc.</span>
            </div>
          </div>
        </div>

        <div class="link-section fade-in" style="animation-delay: 0.2s">
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
  title: '회사정보 - 매일일독',
  meta: [
    { name: 'description', content: '매일일독 서비스를 운영하는 제이지피랩스의 회사 정보입니다.' },
    { property: 'og:title', content: '회사정보 - 매일일독' },
    { property: 'og:description', content: '매일일독 서비스를 운영하는 제이지피랩스의 회사 정보입니다.' },
    { property: 'og:url', content: 'https://maeil1dok.app/company' },
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

.info-grid {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.info-item {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  padding-bottom: 1rem;
  border-bottom: 1px solid var(--color-border-light);
}

.info-item:last-child {
  border-bottom: none;
  padding-bottom: 0;
}

.info-label {
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--color-text-tertiary);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.info-value {
  font-size: 1rem;
  color: var(--color-text-primary);
}

.external-link {
  color: var(--color-accent-primary);
  text-decoration: none;
  transition: opacity 0.2s;
}

.external-link:hover {
  opacity: 0.8;
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
