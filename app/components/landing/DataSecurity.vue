<script setup lang="ts">
import { pageRoutes } from '~/routing'
import { DATA_NOT_STORED, DATA_STORED, SECURITY_MEASURES } from '~/utils/landing-content'

const [rls, moscow, hash, bruteforce, https, keys] = SECURITY_MEASURES as [
  typeof SECURITY_MEASURES[number], typeof SECURITY_MEASURES[number], typeof SECURITY_MEASURES[number],
  typeof SECURITY_MEASURES[number], typeof SECURITY_MEASURES[number], typeof SECURITY_MEASURES[number],
]

const WORKSPACES = ['Платформа доставки', 'Маркетинг', 'Мобильная команда']
const CIPHER = 'b3f1·9ac0·e27d·41b8·0c9e·77fa·d4a2·5e61·c08b·19f3·aa47·6d2c'
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
        <article class="sec__card sec__card--dark sec__card--wide reveal">
          <div class="sec__top">
            <span class="sec__ico"><UIcon :name="rls.icon!" /></span>
            <span class="sec__proof mono">RLS · PostgreSQL</span>
          </div>
          <h3>{{ rls.title }}</h3>
          <p>{{ rls.text }}</p>
          <div class="lanes" aria-hidden="true">
            <div v-for="(w, i) in WORKSPACES" :key="w" class="lanes__row" :class="{ own: i === 0 }">
              <span class="lanes__name">{{ w }}</span>
              <span class="lanes__bar"><i /></span>
              <UIcon :name="i === 0 ? 'i-hugeicons-checkmark-circle-02' : 'i-hugeicons-square-lock-02'" class="lanes__ico" />
            </div>
          </div>
        </article>

        <article class="sec__card reveal">
          <div class="sec__top">
            <span class="sec__ico sec__ico--pulse"><UIcon :name="moscow.icon!" /></span>
            <span class="sec__proof mono">Москва · 152-ФЗ</span>
          </div>
          <h3>{{ moscow.title }}</h3>
          <p>{{ moscow.text }}</p>
        </article>

        <article class="sec__card reveal">
          <div class="sec__top">
            <span class="sec__ico sec__ico--bob"><UIcon :name="hash.icon!" /></span>
            <span class="sec__proof mono">scrypt + соль</span>
          </div>
          <h3>{{ hash.title }}</h3>
          <p>{{ hash.text }}</p>
          <code class="sec__hash mono">$scrypt$n=16384,r=8…</code>
        </article>

        <article class="sec__card reveal">
          <div class="sec__top">
            <span class="sec__ico"><UIcon :name="bruteforce.icon!" /></span>
            <span class="sec__proof mono">5 / 15 мин</span>
          </div>
          <h3>{{ bruteforce.title }}</h3>
          <p>{{ bruteforce.text }}</p>
          <div class="tries" aria-hidden="true">
            <i v-for="n in 5" :key="n" :style="{ '--n': n }" />
            <UIcon name="i-hugeicons-square-lock-02" class="tries__lock" />
          </div>
        </article>

        <article class="sec__card reveal">
          <div class="sec__top">
            <span class="sec__ico sec__ico--spin"><UIcon :name="https.icon!" /></span>
            <span class="sec__proof mono">TLS · HTTP-only</span>
          </div>
          <h3>{{ https.title }}</h3>
          <p>{{ https.text }}</p>
        </article>

        <article class="sec__card sec__card--soft sec__card--wide reveal">
          <div class="sec__top">
            <span class="sec__ico"><UIcon :name="keys.icon!" /></span>
            <span class="sec__proof mono">AES-GCM</span>
          </div>
          <h3>{{ keys.title }}</h3>
          <p>{{ keys.text }}</p>
          <div class="cipher mono" aria-hidden="true"><span>{{ CIPHER }}</span><span>{{ CIPHER }}</span></div>
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

.sec { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-top: 16px; }
.sec__card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 26px;
  border: 1px solid var(--line);
  border-radius: 22px;
  background: #fff;
  overflow: hidden;
}
.sec__card--wide { grid-column: span 2; }
.sec__card--dark { background: var(--ink); border-color: transparent; color: #fff; }
.sec__card--soft { background: var(--soft); border-color: transparent; }
.sec__card h3 { margin-top: 14px; font-size: 18px; line-height: 1.3; }
.sec__card p { color: var(--ink-2); font-size: 14.5px; }
.sec__card--dark p { color: rgba(255, 255, 255, 0.66); }

.sec__top { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
.sec__ico {
  position: relative;
  display: grid;
  place-items: center;
  width: 46px;
  height: 46px;
  border-radius: 14px;
  background: var(--orange-soft);
  color: var(--orange);
  font-size: 22px;
}
.sec__card--dark .sec__ico { background: rgba(232, 80, 2, 0.16); }
.sec__proof { font-size: 11px; color: var(--ink-3); letter-spacing: 0.04em; }
.sec__card--dark .sec__proof { color: rgba(255, 255, 255, 0.45); }

.sec__ico--pulse::after {
  content: "";
  position: absolute;
  inset: 0;
  border-radius: 14px;
  border: 1.5px solid var(--orange);
  animation: sec-ring 2.4s ease-out infinite;
}
.sec__ico--bob :deep(svg) { animation: sec-bob 2.8s ease-in-out infinite; }
.sec__ico--spin :deep(svg) { animation: sec-spin 12s linear infinite; }

.sec__hash { margin-top: auto; padding-top: 10px; font-size: 12px; color: var(--ink-3); }

.lanes { display: grid; gap: 10px; margin-top: auto; padding-top: 18px; }
.lanes__row { display: grid; grid-template-columns: 150px 1fr 18px; align-items: center; gap: 12px; font-size: 13px; color: rgba(255, 255, 255, 0.4); }
.lanes__row.own { color: #fff; }
.lanes__bar { position: relative; height: 8px; border-radius: 999px; background: rgba(255, 255, 255, 0.08); overflow: hidden; }
.lanes__row.own .lanes__bar i {
  position: absolute;
  inset: 0 auto 0 0;
  width: 40%;
  border-radius: 999px;
  background: var(--orange);
  animation: sec-scan 2.6s var(--ease) infinite;
}
.lanes__ico { width: 18px; height: 18px; }
.lanes__row.own .lanes__ico { color: var(--orange); }

.tries { display: flex; align-items: center; gap: 6px; margin-top: auto; padding-top: 12px; }
.tries i { width: 10px; height: 10px; border-radius: 50%; background: var(--line); animation: sec-try 5s steps(1) infinite; animation-delay: calc(var(--n) * 0.5s); }
.tries__lock { width: 18px; height: 18px; margin-left: 6px; color: var(--ink-3); animation: sec-locked 5s steps(1) infinite; }

.cipher { display: flex; gap: 32px; margin-top: auto; padding-top: 16px; font-size: 13px; color: var(--ink-3); white-space: nowrap; overflow: hidden; mask-image: linear-gradient(90deg, transparent, #000 12%, #000 88%, transparent); }
.cipher span { animation: sec-marquee 18s linear infinite; }

.ctrl { display: flex; justify-content: space-between; align-items: center; gap: 24px; margin-top: 16px; padding: 22px 28px; border-radius: 22px; background: var(--soft); }
.ctrl b { font-weight: 500; }

@keyframes sec-ring { from { transform: scale(1); opacity: 0.7; } to { transform: scale(1.6); opacity: 0; } }
@keyframes sec-bob { 50% { transform: translateY(-2px); } }
@keyframes sec-spin { to { transform: rotate(360deg); } }
@keyframes sec-scan { 0% { transform: translateX(-100%); } 60%, 100% { transform: translateX(250%); } }
@keyframes sec-try { 0% { background: var(--line); } 1% { background: var(--ink); } 60% { background: var(--line); } }
@keyframes sec-locked { 0% { color: var(--ink-3); } 55% { color: var(--orange); } 90% { color: var(--ink-3); } }
@keyframes sec-marquee { to { transform: translateX(calc(-100% - 32px)); } }

@media (max-width: 1000px) {
  .sec { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 700px) {
  .ledger { grid-template-columns: 1fr; }
  .ledger > div + div { border-left: 0; border-top: 1px solid rgba(255, 255, 255, 0.12); }
  .sec { grid-template-columns: 1fr; }
  .sec__card--wide { grid-column: auto; }
  .lanes__row { grid-template-columns: 110px 1fr 18px; }
  .ctrl { flex-direction: column; align-items: flex-start; }
}
</style>
