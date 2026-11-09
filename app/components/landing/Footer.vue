<script setup lang="ts">
import { pageRoutes } from '~/routing'
import { AUTHOR_EMAIL, LANDING_CHANNEL_LINKS } from '~/utils/landing-content'

const channels = computed(() => [
  LANDING_CHANNEL_LINKS.telegram && { label: 'Telegram', href: LANDING_CHANNEL_LINKS.telegram },
  LANDING_CHANNEL_LINKS.vk && { label: 'ВКонтакте', href: LANDING_CHANNEL_LINKS.vk },
].filter((c): c is { label: string, href: string } => !!c))

const year = new Date().getFullYear()
</script>

<template>
  <footer class="lfoot" data-cta-end>
    <div class="wrap">
      <div class="lfoot__cols">
        <div class="lfoot__brand">
          <a class="lfoot__logo" href="/#top"><TaktMark class="lfoot__mark" /><b>Такт</b><i>*</i></a>
          <div v-if="channels.length" class="lfoot__channel">
            <p>Канал Такта – релизы и разборы</p>
            <div class="lfoot__channel-links">
              <a v-for="c in channels" :key="c.href" :href="c.href" target="_blank" rel="noopener">{{ c.label }}</a>
            </div>
          </div>
        </div>
        <div>
          <b>Продукт</b>
          <a href="/#features">Возможности</a>
          <a href="/#updates">Обновления</a>
          <a href="/#plans">Планы</a>
        </div>
        <div>
          <b>Ресурсы</b>
          <a href="/docs">Документация</a>
          <a href="/docs/math">Как считается прогноз</a>
          <a :href="pageRoutes.feedback">Оставить отзыв</a>
        </div>
        <div>
          <b>Документы</b>
          <a :href="pageRoutes.privacy">Политика обработки персональных данных</a>
          <a :href="pageRoutes.consent">Согласие на обработку персональных данных</a>
          <a :href="pageRoutes.terms">Пользовательское соглашение</a>
        </div>
        <div>
          <b>Связь</b>
          <a :href="`mailto:${AUTHOR_EMAIL}`">{{ AUTHOR_EMAIL }}</a>
        </div>
      </div>
      <p class="lfoot__copy muted">© {{ year }} Такт · дипломный проект магистранта ВолГУ</p>
    </div>
  </footer>
</template>

<style scoped>
.lfoot { border-top: 1px solid var(--line); padding: 48px 0 32px; margin-top: 48px; }
.lfoot__cols { display: grid; grid-template-columns: 1.3fr repeat(4, 1fr); gap: 28px; font-size: 14px; }
.lfoot__cols b { display: block; font-weight: 500; margin-bottom: 12px; }
.lfoot__cols a { display: block; color: var(--ink-2); margin-bottom: 8px; transition: color 0.2s; }
.lfoot__cols a:hover { color: var(--ink); }
.lfoot__logo { display: flex !important; align-items: center; gap: 8px; color: var(--ink) !important; font: 600 18px var(--font-wordmark); }
.lfoot__logo i { font-style: normal; color: var(--orange); }
.lfoot__mark { width: 24px; height: 24px; }
.lfoot__channel { margin-top: 18px; padding: 16px; border-radius: 16px; background: var(--soft); }
.lfoot__channel p { margin-bottom: 8px; }
.lfoot__channel-links { display: flex; gap: 14px; }
.lfoot__copy { margin-top: 40px; font-size: 13px; }

@media (max-width: 900px) {
  .lfoot__cols { grid-template-columns: 1fr 1fr; }
  .lfoot__brand { grid-column: 1 / -1; }
}
</style>
