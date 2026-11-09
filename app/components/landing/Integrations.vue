<script setup lang="ts">
import { INTEGRATIONS_SOON } from '~/utils/landing-content'
</script>

<template>
  <section id="integrations" class="section">
    <div class="wrap">
      <LandingSectionHead :n="5" label="интеграции" title="Работает рядом с вашими инструментами" />
      <div class="int">
        <article class="int__card reveal">
          <div>
            <img class="int__logo" src="/integrations/pachca.svg" alt="" width="48" height="48">
            <h3>«Пачка»</h3>
            <p class="muted">Личные уведомления, лента доски в командный чат и превью ссылок на задачи.</p>
          </div>
          <div class="int__msg" aria-hidden="true">
            <small class="mono">Такт · бот</small>
            <b>ПОТ-42 перешла в «Ревью»</b>
            Экран настроек интеграции · Анна → Иван
          </div>
        </article>
        <article class="int__card reveal">
          <div>
            <span class="int__logo int__logo--mail"><UIcon name="i-hugeicons-mail-01" /></span>
            <h3>Утренний дайджест</h3>
            <p class="muted">Письмо в 9:00 по Москве: что горит, что назначено вам и что ждёт ответа.</p>
          </div>
          <div class="int__msg" aria-hidden="true">
            <small class="mono">09:00 · дайджест</small>
            <b>3 задачи на сегодня</b>
            1 просрочена · 2 упоминания
          </div>
        </article>
      </div>
      <div class="int__soon reveal">
        <small class="mono">В релизе 0.6</small>
        <span v-for="s in INTEGRATIONS_SOON" :key="s">{{ s }}</span>
      </div>
    </div>
  </section>
</template>

<style scoped>
.int { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.int__card { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; align-items: center; padding: 28px; border-radius: 24px; background: var(--soft); }
.int__logo { display: grid; place-items: center; width: 48px; height: 48px; border-radius: 14px; }
.int__logo--mail { background: var(--orange); color: #fff; font-size: 24px; }
.int__card h3 { font-size: 22px; margin: 14px 0 8px; }
.int__msg { padding: 14px 16px; border-radius: 16px; background: #fff; box-shadow: 0 10px 30px -18px rgba(0, 0, 0, 0.3); font-size: 13px; }
.int__msg small { display: block; font-size: 11px; color: var(--ink-3); }
.int__msg b { display: block; margin: 4px 0 2px; font-weight: 500; }
.int__soon { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; margin-top: 16px; padding: 18px 22px; border: 1px dashed var(--line); border-radius: 20px; }
.int__soon small { margin-right: 8px; font-size: 11px; letter-spacing: 0.06em; text-transform: uppercase; color: var(--ink-3); }
.int__soon span { padding: 8px 14px; border: 1px solid var(--line); border-radius: 999px; font-size: 14px; }

@media (max-width: 1000px) {
  .int { grid-template-columns: 1fr; }
}
@media (max-width: 560px) {
  .int__card { grid-template-columns: 1fr; }
}
</style>
