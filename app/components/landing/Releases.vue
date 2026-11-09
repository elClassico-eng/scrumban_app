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
.tl { position: relative; list-style: none; display: grid; gap: 22px; margin: 24px 0 0; padding: 0 0 0 24px; }
.tl::before {
  content: "";
  position: absolute;
  left: -0.75px;
  top: 0;
  bottom: 0;
  width: 1.5px;
  background: var(--ink);
  transform-origin: top;
}
.reveal.in .tl::before { animation: tl-draw 1.2s var(--ease) forwards; }
.reveal.in .tl li { animation: tl-in 0.5s var(--ease) forwards; }
.reveal.in .tl li:nth-child(2) { animation-delay: 0.25s; }
.reveal.in .tl li:nth-child(3) { animation-delay: 0.5s; }
.reveal.in .tl li:nth-child(4) { animation-delay: 0.75s; }
.tl li.now::after {
  content: "";
  position: absolute;
  left: -29px;
  top: 6px;
  width: 10px;
  height: 10px;
  border-radius: 50%;
  border: 1.5px solid var(--orange);
  animation: tl-ring 2.2s ease-out 1.2s infinite;
}
.tl li { position: relative; }
.tl li::before {
  content: "";
  position: absolute;
  left: -29px;
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
.tl--dark::before { background: #fff; }
.tl--dark li::before { border-color: #fff; background: var(--ink); }
.tl--dark small { color: var(--orange); }

@keyframes tl-draw { to { transform: scaleY(1); } }
@keyframes tl-in { to { opacity: 1; transform: none; } }
@keyframes tl-ring { from { transform: scale(1); opacity: 0.8; } to { transform: scale(2.4); opacity: 0; } }

@media (max-width: 900px) {
  .rel { grid-template-columns: 1fr; }
}
</style>
