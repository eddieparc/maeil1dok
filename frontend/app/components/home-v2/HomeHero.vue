<template>
  <section class="home-hero">
    <p class="hero-kicker">매일일독</p>
    <h1>오늘도 말씀을 따라가요</h1>
    <p class="hero-copy">통독표로 오늘 분량을 확인하고, 필요한 플랜은 따로 관리하세요.</p>
  </section>
</template>

<style scoped>
.home-hero {
  padding: 0.75rem 0 0.25rem;
}

.hero-kicker {
  margin: 0 0 0.375rem;
  color: var(--accent);
  font-size: 0.8125rem;
  font-weight: 700;
}

h1 {
  margin: 0;
  color: var(--text-main);
  font-family: var(--font-serif);
  font-size: clamp(1.875rem, 8vw, 2.75rem);
  font-weight: 700;
  line-height: 1.18;
}

.hero-copy {
  max-width: 28rem;
  margin: 0.75rem 0 0;
  color: var(--text-sub);
  font-size: 0.9375rem;
  line-height: 1.65;
}
</style>
