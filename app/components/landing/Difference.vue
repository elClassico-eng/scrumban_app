<script setup lang="ts">
import { COMPARISON } from '~/utils/landing-content'
</script>

<template>
  <section id="forecast" class="section">
    <div class="wrap">
      <LandingSectionHead :n="4" label="чем отличается" title="Не ещё один таск-трекер" />
      <div class="diff">
        <article class="card card--dark diff__cone reveal">
          <h3>Прогноз – это конус, а не дата</h3>
          <p class="muted">Чем дальше срок, тем шире разброс. Обычный план прячет это за одной датой, Такт показывает честно.</p>
          <svg viewBox="0 0 500 260" fill="none" aria-hidden="true">
            <g class="diff__grid"><line x1="140" y1="20" x2="140" y2="250" /><line x1="260" y1="20" x2="260" y2="250" /><line x1="380" y1="20" x2="380" y2="250" /></g>
            <path class="diff__line" d="M20 240 Q 260 40 480 30" stroke="#e85002" stroke-width="1.5" />
            <path class="diff__line" d="M20 240 Q 260 110 480 110" stroke="#fff" stroke-opacity=".5" />
            <path class="diff__line" d="M20 240 Q 260 170 480 190" stroke="#fff" stroke-opacity=".3" />
            <text x="440" y="22" fill="#e85002">P95</text>
            <text x="440" y="102" fill="#fff">P85</text>
            <text x="440" y="182" fill="#fff">P50</text>
          </svg>
        </article>
        <article class="card diff__table reveal">
          <div class="diff__grid-table" role="table" aria-label="Обычный трекер и Такт">
            <div role="row" class="diff__head">
              <span role="columnheader" />
              <span role="columnheader">Обычно</span>
              <span role="columnheader" class="us">В Такте</span>
            </div>
            <div v-for="r in COMPARISON" :key="r.topic" role="row">
              <span role="rowheader">{{ r.topic }}</span>
              <span role="cell" class="old">{{ r.usual }}</span>
              <span role="cell" class="new">{{ r.takt }}</span>
            </div>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.diff { display: grid; grid-template-columns: 1.05fr 1fr; gap: 16px; }
.diff__cone h3 { font-size: 30px; line-height: 1.15; }
.diff__cone p { margin-top: 12px; }
.diff__cone svg { width: 100%; height: auto; margin-top: 20px; }
.diff__cone text { font: 11px var(--font-mono); }
.diff__grid line { stroke: rgba(255, 255, 255, 0.08); }
.diff__line { stroke-dasharray: 700; stroke-dashoffset: 700; }
.diff__cone.in .diff__line { animation: diff-draw 2.4s var(--ease) forwards, diff-breathe 5s ease-in-out 2.4s infinite; }
.diff__cone.in .diff__line:nth-of-type(2) { animation-delay: 0.25s, 2.65s; }
.diff__cone.in .diff__line:nth-of-type(3) { animation-delay: 0.5s, 2.9s; }

@keyframes diff-draw { to { stroke-dashoffset: 0; } }
@keyframes diff-breathe { 50% { opacity: 0.55; } }

.diff__grid-table > div { display: grid; grid-template-columns: 110px 1fr 1fr; border-bottom: 1px solid var(--line); }
.diff__grid-table span { padding: 15px 0; font-size: 15px; }
.diff__head span { padding-top: 0; font: 11px var(--font-mono); text-transform: uppercase; letter-spacing: 0.06em; color: var(--ink-3); }
.diff__head .us { color: var(--orange); }
.old { color: var(--ink-3); padding-right: 16px !important; }
.new { font-weight: 500; }
.new::before { content: "✓ "; color: var(--orange); }

@media (max-width: 900px) {
  .diff { grid-template-columns: 1fr; }
}
@media (max-width: 520px) {
  .diff__grid-table > div { grid-template-columns: 84px 1fr 1fr; }
  .diff__grid-table span { font-size: 13.5px; }
}
@media (prefers-reduced-motion: reduce) {
  .diff__line { stroke-dashoffset: 0; }
}
</style>
