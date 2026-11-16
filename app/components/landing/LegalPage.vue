<script setup lang="ts">
import '~/assets/css/landing.css'

const props = defineProps<{
  title: string
  updated: string
  lead: string
  toc: { id: string, title: string }[]
}>()

useHead({ title: `${props.title} – Такт` })
</script>

<template>
  <div class="landing">
    <LandingHeader />
    <main class="legal">
      <div class="wrap legal__wrap">
        <p class="legal__tag">Правовая информация</p>
        <h1>{{ title }}</h1>
        <p class="legal__meta">Редакция от {{ updated }}</p>
        <p class="legal__lead">{{ lead }}</p>
        <nav class="legal__toc" aria-label="Содержание">
          <a v-for="(s, i) in toc" :key="s.id" :href="`#${s.id}`"><span>{{ String(i + 1).padStart(2, '0') }}</span>{{ s.title }}</a>
        </nav>
        <div class="legal__body">
          <slot />
        </div>
      </div>
    </main>
    <LandingFooter />
  </div>
</template>

<style scoped>
.legal { padding: 56px 0 24px; }
.legal__wrap { max-width: 820px; }
.legal__tag { font: 11px var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--orange); }
.legal h1 { font-size: clamp(32px, 5vw, 48px); line-height: 1.08; margin-top: 14px; }
.legal__meta { margin-top: 12px; font: 12px var(--font-mono); color: var(--ink-3); }
.legal__lead { margin-top: 24px; font-size: 18px; line-height: 1.55; color: var(--ink-2); }
.legal__toc {
  display: grid;
  gap: 6px;
  margin: 36px 0 8px;
  padding: 22px 24px;
  border-radius: 20px;
  background: var(--soft);
  font-size: 14.5px;
}
.legal__toc a { display: flex; gap: 12px; }
.legal__toc a:hover { color: var(--orange); }
.legal__toc span { font: 12px/1.9 var(--font-mono); color: var(--ink-3); }

.legal__body :deep(section) { scroll-margin-top: 96px; padding-top: 40px; }
.legal__body :deep(h2) { font-size: 24px; line-height: 1.25; margin-bottom: 14px; }
.legal__body :deep(h3) { font-size: 17px; margin: 20px 0 8px; }
.legal__body :deep(p),
.legal__body :deep(li) { font-size: 15.5px; line-height: 1.65; color: #2c2b28; }
.legal__body :deep(p + p) { margin-top: 10px; }
.legal__body :deep(ul) { margin: 8px 0 0; padding-left: 20px; display: grid; gap: 6px; }
.legal__body :deep(a) { color: var(--orange); text-decoration: underline; text-underline-offset: 3px; }
</style>
