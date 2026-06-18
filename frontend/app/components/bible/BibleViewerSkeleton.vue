<template>
  <div class="bible-skeleton-container">
    <div v-for="i in verseCount" :key="i" class="skeleton-verse">
      <Skeleton
        class="skeleton-number"
        width="var(--verse-number-size)"
        height="var(--verse-number-size)"
        rounded="full"
      />

      <div class="skeleton-content">
        <Skeleton class="skeleton-line" :width="getLineWidth(i, 0)" height="1rem" rounded="sm" />
        <Skeleton class="skeleton-line" :width="getLineWidth(i, 1)" height="1rem" rounded="sm" />
        <Skeleton
          v-if="i % 3 !== 0"
          class="skeleton-line"
          :width="getLineWidth(i, 2)"
          height="1rem"
          rounded="sm"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import Skeleton from '~/components/ui/skeleton/Skeleton.vue';

interface Props {
  verseCount?: number;
}

const { verseCount } = withDefaults(defineProps<Props>(), {
  verseCount: 8,
});

// Deterministic width generation based on index to avoid hydration mismatches
const getLineWidth = (index: number, lineIndex: number): string => {
  const baseWidths = [
    [95, 85, 60], // verse 0 pattern
    [90, 75, 0],  // verse 1 pattern (2 lines)
    [100, 90, 40], // verse 2 pattern
  ];
  
  const pattern = baseWidths[index % 3];
  const width = pattern[lineIndex] || 70;
  
  // Add slight variation based on index
  const variation = (index * 5) % 15;
  
  return `${width - variation}%`;
};
</script>

<style scoped>
.bible-skeleton-container {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  width: 100%;
  animation: fadeIn 0.5s ease-out;
}

.skeleton-verse {
  display: flex;
  align-items: flex-start;
  gap: 0.5rem;
  padding: 0.25rem 0;
}

.skeleton-number {
  --verse-number-size: 1.5rem;

  width: var(--verse-number-size);
  height: var(--verse-number-size);
  border-radius: 50%;
  flex-shrink: 0;
  margin-top: 0.2rem;
}

.skeleton-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
}

.skeleton-line {
  border-radius: 4px;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

/* Responsive adjustments */
@media (max-width: 768px) {
  .skeleton-number {
    --verse-number-size: 1.2rem;
  }

  .skeleton-verse {
    gap: 0.3rem;
  }
}
</style>
