<template>
  <aside v-if="eligible && !unavailable" ref="container" class="reader-ad" aria-label="광고">
    <span class="reader-ad-label">광고</span>
    <div style="height: 50px">
      <ins
        ref="unit"
        class="adsbygoogle"
        style="display: block; width: 100%; height: 50px"
        data-ad-client="ca-pub-8742107706365412"
        data-ad-slot="1216284793"
        :data-adtest="isDevelopment ? 'on' : undefined"
      ></ins>
    </div>
  </aside>
</template>

<script lang="ts">
interface AdSenseQueue {
  push(request: Record<string, never>): unknown;
  requestNonPersonalizedAds?: number;
}

declare global {
  interface Window {
    adsbygoogle?: AdSenseQueue;
  }
}

let scriptReady: Promise<boolean> | undefined;

function loadAdSense(): Promise<boolean> {
  if (scriptReady) return scriptReady;
  scriptReady = new Promise((resolve) => {
    const script = document.createElement('script');
    window.adsbygoogle ??= [];
    window.adsbygoogle.requestNonPersonalizedAds = 1;
    const finish = (loaded: boolean) => {
      clearTimeout(timeout);
      script.onload = null;
      script.onerror = null;
      resolve(loaded);
    };
    const timeout = setTimeout(() => finish(false), 8000);
    script.async = true;
    script.crossOrigin = 'anonymous';
    script.src = 'https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-8742107706365412';
    script.onload = () => finish(true);
    script.onerror = () => finish(false);
    document.head.appendChild(script);
  });
  return scriptReady;
}
</script>

<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue';

const container = ref<HTMLElement | null>(null);
const unit = ref<HTMLElement | null>(null);
const eligible = ref(false);
const unavailable = ref(false);
const isDevelopment = import.meta.dev;
let visibility: IntersectionObserver | undefined;
let status: MutationObserver | undefined;
let disposed = false;
let requested = false;

onMounted(async () => {
  if (window.isReactNativeWebView || window.ReactNativeWebView) return;
  eligible.value = true;
  await nextTick();
  if (disposed || !container.value || !unit.value) return;

  visibility = new IntersectionObserver(async (entries) => {
    if (requested || !entries.some(entry => entry.isIntersecting)) return;
    requested = true;
    visibility?.disconnect();
    if (!unit.value || unit.value.getBoundingClientRect().width < 120) {
      unavailable.value = true;
      return;
    }
    const loaded = await loadAdSense();
    if (disposed) return;
    if (!loaded || !unit.value) {
      unavailable.value = true;
      return;
    }
    status = new MutationObserver(() => {
      if (unit.value?.getAttribute('data-ad-status') === 'unfilled') {
        unavailable.value = true;
        status?.disconnect();
      }
    });
    status.observe(unit.value, { attributes: true, attributeFilter: ['data-ad-status'] });
    try {
      window.adsbygoogle?.push({});
    } catch (error) {
      // A third-party ad failure must not interrupt reading or chapter navigation.
      unavailable.value = true;
      status.disconnect();
      console.warn('[AdSense] Reader ad unavailable', error);
    }
  });
  visibility.observe(container.value);
});

onBeforeUnmount(() => {
  disposed = true;
  visibility?.disconnect();
  status?.disconnect();
});
</script>

<style scoped>
.reader-ad {
  width: 100%;
  max-width: 320px;
  margin: 2rem auto;
  font-family: 'Pretendard', sans-serif;
}

.reader-ad-label {
  display: block;
  margin-bottom: 0.5rem;
  color: var(--color-text-tertiary);
  font-size: 0.75rem;
  line-height: 1.4;
  text-align: center;
}
</style>
