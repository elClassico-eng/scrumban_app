<script setup lang="ts">
import type { ReleaseEntry } from '~/utils/landing-releases'
import { PLANS } from '~/utils/landing-content'

defineProps<{ releases: ReleaseEntry[] }>()

function formatDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString('ru', { day: 'numeric', month: 'long', timeZone: 'UTC' })
}
</script>

<template>
  <section id="updates" class="section">
    <div class="wrap">
      <LandingSectionHead
        :n="7"
        label="обновления"
        title="Чем дальше – тем точнее"
        lead="Новый релиз примерно раз в две недели. Что уже вышло – и что дальше."
      />
      <div class="rel">
        <article v-if="releases.length" class="card reveal">
          <h3>Журнал релизов</h3>
          <ol class="tl">
            <li v-for="(r, i) in releases" :key="r.path" :class="{ now: i === 0 }">
              <small class="mono">{{ formatDate(r.date) }}</small>
              <b>{{ r.title }}</b>
              <span v-if="r.summary" class="muted">{{ r.summary }}</span>
            </li>
          </ol>
        </article>
        <article id="plans" class="card card--dark reveal">
          <h3>Дальше в планах</h3>
          <ol class="tl tl--dark">
            <li v-for="p in PLANS" :key="p.title">
              <small v-if="p.stage" class="mono">{{ p.stage }}</small>
              <b>{{ p.title }}</b>
              <span v-if="p.text" class="muted">{{ p.text }}</span>
            </li>
          </ol>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.rel { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.rel h3 { font-size: 20px; }
.tl { list-style: none; display: grid; gap: 22px; margin: 24px 0 0; padding: 0 0 0 24px; border-left: 1.5px solid var(--ink); }
.tl li { position: relative; }
.tl li::before {
  content: "";
  position: absolute;
  left: -30px;
  top: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--ink);
  background: #fff;
}
.tl li.now::before { background: var(--orange); border-color: var(--orange); }
.tl small { display: block; font-size: 11px; color: var(--ink-3); }
.tl b { display: block; font: 500 17px/1.35 var(--font-display); }
.tl span { display: block; margin-top: 2px; font-size: 14px; }
.tl--dark { border-color: #fff; }
.tl--dark li::before { border-color: #fff; background: var(--ink); }
.tl--dark small { color: var(--orange); }

@media (max-width: 900px) {
  .rel { grid-template-columns: 1fr; }
}
</style>
