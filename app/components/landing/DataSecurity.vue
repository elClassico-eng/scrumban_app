<script setup lang="ts">
import { pageRoutes } from '~/routing'
import { DATA_NOT_STORED, DATA_STORED, SECURITY_MEASURES } from '~/utils/landing-content'
</script>

<template>
  <section class="section">
    <div class="wrap">
      <LandingSectionHead
        :n="6"
        label="ваши данные"
        title="Данные команды видит только команда"
        lead="Что Такт хранит о вас и вашей команде, чего не хранит и как это защищено."
      />
      <div class="ledger reveal">
        <div>
          <h3>Хранится</h3>
          <div v-for="d in DATA_STORED" :key="d.what" class="ledger__row">
            <span class="ledger__mk">✓</span>
            <span><b>{{ d.what }}</b> – {{ d.why }}</span>
          </div>
        </div>
        <div>
          <h3>Не хранится</h3>
          <div v-for="d in DATA_NOT_STORED" :key="d" class="ledger__row ledger__row--no">
            <span class="ledger__mk">✕</span>
            <span>{{ d }}</span>
          </div>
        </div>
      </div>
      <div class="sec">
        <article v-for="m in SECURITY_MEASURES" :key="m.title" class="sec__card reveal">
          <span class="sec__ico"><UIcon :name="m.icon!" /></span>
          <div>
            <h3>{{ m.title }}</h3>
            <p class="muted">{{ m.text }}</p>
          </div>
        </article>
      </div>
      <div class="ctrl reveal">
        <p>
          <b>Вы управляете своими данными:</b> видите активные сеансы и завершаете лишние, удаляете аккаунт сами – имя и email стираются, а задачи остаются у команды.
        </p>
        <a class="btn btn--dark" :href="pageRoutes.privacy">Политика данных →</a>
      </div>
    </div>
  </section>
</template>

<style scoped>
.ledger { display: grid; grid-template-columns: 1fr 1fr; border-radius: 24px; background: var(--ink); color: #fff; }
.ledger > div { padding: 30px 34px; }
.ledger > div + div { border-left: 1px solid rgba(255, 255, 255, 0.12); }
.ledger h3 { margin-bottom: 10px; font: 11px var(--font-mono); letter-spacing: 0.08em; text-transform: uppercase; color: var(--orange); }
.ledger > div + div h3 { color: rgba(255, 255, 255, 0.45); }
.ledger__row { display: flex; gap: 14px; padding: 13px 0; border-top: 1px solid rgba(255, 255, 255, 0.1); font-size: 15px; }
.ledger__row b { font-weight: 500; }
.ledger__row--no { color: rgba(255, 255, 255, 0.55); }
.ledger__mk { flex: none; width: 16px; color: var(--orange); }
.ledger__row--no .ledger__mk { color: rgba(255, 255, 255, 0.4); }
.sec { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-top: 16px; }
.sec__card { display: flex; gap: 18px; align-items: flex-start; padding: 26px; border: 1px solid var(--line); border-radius: 22px; }
.sec__card h3 { margin-bottom: 6px; font-size: 17px; line-height: 1.3; }
.sec__card p { font-size: 14.5px; }
.sec__ico { flex: none; display: grid; place-items: center; width: 46px; height: 46px; border-radius: 14px; background: var(--orange-soft); color: var(--orange); font-size: 22px; }
.ctrl { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-top: 16px; padding: 22px 28px; border-radius: 22px; background: var(--soft); }
.ctrl b { font-weight: 500; }

@media (max-width: 1000px) {
  .sec { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 700px) {
  .ledger { grid-template-columns: 1fr; }
  .ledger > div + div { border-left: 0; border-top: 1px solid rgba(255, 255, 255, 0.12); }
  .sec { grid-template-columns: 1fr; }
  .ctrl { flex-direction: column; align-items: flex-start; }
}
</style>
