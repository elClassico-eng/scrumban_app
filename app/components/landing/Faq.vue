<script setup lang="ts">
import { FAQ, faqJsonLd } from '~/utils/landing-content'

const items = FAQ.map((f, i) => ({ label: f.q, content: f.a, value: String(i) }))

useHead({
  script: [{ key: 'landing-faq-ld', type: 'application/ld+json', innerHTML: JSON.stringify(faqJsonLd(FAQ)) }],
})
</script>

<template>
  <section class="section">
    <div class="wrap">
      <LandingSectionHead :n="10" label="вопросы" title="Частые вопросы" />
      <UAccordion
        :items="items"
        type="multiple"
        class="faq reveal"
        :ui="{
          item: 'border-b border-[var(--line)]',
          trigger: 'py-5 text-[18px] font-medium text-[var(--ink)] font-[Onest]',
          trailingIcon: 'text-[var(--ink-3)]',
          body: 'pb-5 text-[15px] leading-relaxed text-[var(--ink-2)] max-w-[70ch]',
        }"
      />
    </div>
  </section>
</template>

<style scoped>
.faq { border-top: 1px solid var(--line); }
</style>
