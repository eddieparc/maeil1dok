<script setup lang="ts">
import { ArrowRight } from '@lucide/vue'
import PageLayout from '~/components/common/PageLayout.vue'
import AppButton from '~/components/ui/AppButton.vue'
import ListCard from '~/components/ui/ListCard.vue'

const features = [
  { id: 'selection', title: '플랜 선택 기능', description: '다양한 성경통독 플랜 중에서 나에게 맞는 플랜을 선택할 수 있습니다.' },
  { id: 'progress', title: '플랜별 진도 관리', description: '이제 각 플랜별로 독립적인 진도 관리가 가능해요. 여러 플랜을 동시에 구독하고 진행할 수 있습니다.' },
  { id: 'statistics', title: '플랜별 통계', description: '각 플랜의 전체 진행률과 개인 진행률을 별도로 확인할 수 있습니다.' },
]
</script>

<template>
  <PageLayout title="공지사항" fallback-path="/notice">
    <article class="notice-detail">
      <header>
        <time datetime="2025-03-01">2025년 03월 01일</time>
        <h2>매일일독이 드디어 푸른통독을 지원해요 🎉</h2>
      </header>
      <div class="notice-features" data-testid="notice-features">
        <ListCard v-for="feature in features" :key="feature.id" :data-feature="feature.id">
          <h3>{{ feature.title }}</h3>
          <p>{{ feature.description }}</p>
        </ListCard>
      </div>
      <section class="notice-subscription" aria-labelledby="subscription-title">
        <h3 id="subscription-title">푸른통독 시즌1 구독 방법</h3>
        <ol>
          <li>하단 '플랜 관리로 이동' 버튼 클릭</li>
          <li>푸른통독 시즌1 구독하기(로그인 필요)</li>
          <li>메인 화면에서 플랜 선택</li>
        </ol>
      </section>
      <AppButton to="/plans" block>플랜 관리로 이동<ArrowRight :size="18" aria-hidden="true" /></AppButton>
    </article>
  </PageLayout>
</template>

<style scoped>
.notice-detail { display: grid; gap: 20px; padding: 20px var(--screen-gutter) 32px; color: var(--color-text-primary); letter-spacing: var(--tracking-body); }
.notice-detail time { font-size: 12px; color: var(--color-text-tertiary); }
.notice-detail h2 { margin: 8px 0 0; font-size: 24px; font-weight: 700; line-height: 1.3; letter-spacing: var(--tracking-display); }
.notice-features { display: grid; gap: 14px; }
.notice-detail h3 { margin: 0 0 8px; font-size: 14px; font-weight: 700; }
.notice-detail p { margin: 0; font-size: 15px; line-height: 1.75; color: var(--color-text-secondary); }
.notice-subscription ol { margin: 12px 0 0; padding-left: 24px; font-size: 15px; line-height: 1.75; color: var(--color-text-secondary); }
.notice-subscription li { padding-left: 4px; margin-top: 8px; }
.notice-subscription li::marker { color: var(--color-accent-primary); font-weight: 700; }
@media (min-width: 1024px) { .notice-detail { padding-block: 32px 40px; } }
</style>
