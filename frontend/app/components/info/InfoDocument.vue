<script setup lang="ts">
import ListCard from '~/components/ui/ListCard.vue'

defineProps<{
  document: {
    title: string
    effectiveDate: string
    intro: string
    sections: Array<{ id: string; title: string; html: string }>
  }
  navigateSection: (id: string) => void
}>()
</script>

<template>
  <header class="document-heading">
    <p>시행일 {{ document.effectiveDate }}</p>
    <h2>{{ document.title }}</h2>
  </header>
  <ListCard title="목차">
    <nav class="document-toc" aria-label="조항 목차" data-testid="legal-toc">
      <a v-for="section in document.sections" :key="section.id" :href="`#${section.id}`" @click.prevent="navigateSection(section.id)">{{ section.title }}</a>
    </nav>
  </ListCard>
  <article class="legal-copy" data-testid="legal-copy">
    <p class="document-intro">{{ document.intro }}</p>
    <section v-for="section in document.sections" :id="section.id" :key="section.id" class="legal-section" tabindex="-1" :aria-labelledby="`${section.id}-heading`">
      <h3 :id="`${section.id}-heading`">{{ section.title }}</h3>
      <!-- HTML is shipped local legal copy, never API or user input. -->
      <div v-html="section.html" />
    </section>
  </article>
</template>

<style scoped>
.document-heading p { margin: 0 0 8px; color: var(--color-text-tertiary); font-size: 12px; }
.document-heading h2 { margin: 0; font-size: 22px; font-weight: 700; line-height: 1.3; letter-spacing: var(--tracking-display); }
.document-toc { display: flex; flex-direction: column; }
.document-toc a { display: flex; align-items: center; min-width: var(--hit-min); min-height: var(--hit-min); padding: 8px; border-radius: var(--radius-control); color: var(--color-accent-primary); font-size: 13px; font-weight: 600; text-decoration: none; }
.document-toc a:hover, .document-toc a:active { background: var(--color-accent-bg); }
.legal-copy { font-size: 14px; line-height: 1.75; overflow-wrap: anywhere; }
.document-intro { margin: 0 0 24px; color: var(--color-text-secondary); }
.legal-section { margin-bottom: 24px; }
.legal-section:last-child { margin-bottom: 0; }
.legal-section h3 { margin: 0 0 8px; font-size: 15px; line-height: 1.4; font-weight: 700; }
.legal-section :deep(p) { margin: 0 0 12px; }
.legal-section :deep(ul), .legal-section :deep(ol) { margin: 0; padding-left: 20px; }
.legal-section :deep(ul) { list-style: disc; }
.legal-section :deep(ol) { list-style: decimal; }
.legal-section :deep(li) { margin-bottom: 8px; }
.legal-section :deep(strong) { font-weight: 600; }
.legal-section :deep(.effective-date) { margin-top: 16px; padding-top: 16px; border-top: 1px solid var(--color-border-default); }
</style>
