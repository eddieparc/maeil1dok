<script setup lang="ts">
import { useCdnAsset } from '~/composables/useCdnAsset';
import { useHead } from '#imports'
import { ExternalLink, Mail } from '@lucide/vue'
import InfoLayout from '~/components/info/InfoLayout.vue'
import ListCard from '~/components/ui/ListCard.vue'
const { cdnAsset } = useCdnAsset();

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

<template>
  <InfoLayout>
    <img :src="cdnAsset('/images/logo-transparent.png')" alt="매일일독" class="company-logo">
    <h2 class="company-heading">매일 말씀을 읽는 습관,<br>함께 만들어요</h2>
    <p class="company-intro">매일일독은 성경 통독을 꾸준히 이어가도록 돕는 서비스예요. 통독표, 오디오, 하세나하시조 영상, 함께 읽는 그룹까지 하루의 읽기를 한 곳에서 이어갑니다.</p>
    <div class="company-stats">
      <ListCard data-testid="company-service-start" :data-available="false">
        <p class="stat-label">서비스 시작</p><p class="stat-value">정보 미제공</p>
        <p class="stat-note">공식 시작일 미확인</p>
      </ListCard>
      <ListCard data-testid="company-readers" :data-available="false">
        <p class="stat-label">함께 읽는 사람</p><p class="stat-value">집계 미제공</p>
        <p class="stat-note">확인된 통계가 없어요</p>
      </ListCard>
    </div>
    <ListCard title="운영 및 연락처">
      <dl class="company-details">
        <div><dt>운영</dt><dd>제이지피랩스</dd></div>
        <div><dt>대표자</dt><dd>박지건</dd></div>
        <div><dt>이메일</dt><dd><a href="mailto:support@maeil1dok.app" data-testid="company-email"><Mail :size="16" aria-hidden="true" />support@maeil1dok.app</a></dd></div>
        <div><dt>주소</dt><dd>경기도 용인시 기흥구 동백4로 6, 6105호</dd></div>
        <div><dt>전화</dt><dd><a href="tel:01023689677">010-2368-9677</a></dd></div>
        <div><dt>사업자등록번호</dt><dd>613-24-62749</dd></div>
        <div><dt>통신판매업 신고번호</dt><dd>제 2022-용인기흥-1517 호</dd></div>
        <div><dt>개인정보 보호책임자</dt><dd>박지건</dd></div>
      </dl>
      <a class="company-verification" href="https://www.ftc.go.kr/bizCommPop.do?wrkr_no=6132462749" target="_blank" rel="noopener noreferrer" data-testid="company-verification">사업자정보확인 <ExternalLink :size="16" aria-hidden="true" /><span class="sr-only">(새 창)</span></a>
    </ListCard>
  </InfoLayout>
</template>

<style scoped>
.company-logo { width: auto; height: 26px; object-fit: contain; align-self: flex-start; }
[data-theme="dark"] .company-logo { filter: brightness(0) invert(1); }
.company-heading { margin: 0; font-size: 24px; line-height: 1.3; font-weight: 700; letter-spacing: var(--tracking-display); }
.company-intro { margin: 0; font-size: 15px; line-height: 1.75; }
.company-stats { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
.stat-label, .stat-note { margin: 0; font-size: 12px; color: var(--color-text-secondary); }
.stat-value { margin: 8px 0; font-size: 18px; font-weight: 700; }
.company-details { margin: 0; }
.company-details > div { display: grid; grid-template-columns: minmax(80px, 1fr) minmax(0, 2fr); align-items: center; gap: 12px; min-height: 56px; padding-block: 12px; border-bottom: 1px solid var(--color-border-light); font-size: 13px; line-height: 1.5; }
.company-details dt { color: var(--color-text-secondary); }
.company-details dd { margin: 0; font-weight: 600; text-align: right; overflow-wrap: anywhere; }
.company-details a, .company-verification { display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-width: var(--hit-min); min-height: var(--hit-min); border-radius: var(--radius-control); color: var(--color-accent-primary); text-decoration: none; }
.company-details a svg { flex: none; }
.company-details a:hover, .company-verification:hover, .company-details a:active, .company-verification:active { background: var(--color-accent-bg); }
.company-verification { margin-top: 12px; padding-inline: 8px; font-size: 13px; font-weight: 600; }
@media (max-width: 380px) {
  .company-details > div { grid-template-columns: 1fr; gap: 4px; }
  .company-details dd { text-align: left; }
}
</style>
