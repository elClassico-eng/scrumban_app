<script setup lang="ts">
import { STEPS } from '~/utils/landing-content'
</script>

<template>
  <section class="section">
    <div class="wrap">
      <LandingSectionHead :n="2" label="как это работает" title="Прогноз из того, что вы и так делаете" />
      <div class="how">
        <article v-for="(s, i) in STEPS" :key="s.title" class="how__card reveal">
          <span class="how__num mono">0{{ i + 1 }}</span>
          <div class="how__illo" aria-hidden="true">
            <svg v-if="i === 0" viewBox="0 0 150 96" fill="none" stroke="#111110" stroke-width="1.5">
              <rect x="1" y="6" width="44" height="84" rx="8" stroke-opacity=".25" />
              <rect x="53" y="6" width="44" height="84" rx="8" stroke-opacity=".25" />
              <rect x="105" y="6" width="44" height="84" rx="8" stroke-opacity=".25" />
              <rect x="8" y="16" width="30" height="16" rx="4" />
              <rect x="8" y="38" width="30" height="16" rx="4" />
              <rect x="60" y="16" width="30" height="16" rx="4" />
              <rect x="112" y="16" width="30" height="16" rx="4" stroke-opacity=".4" />
              <rect class="how__moving" x="60" y="40" width="30" height="16" rx="4" fill="#e85002" stroke="#e85002" />
            </svg>
            <svg v-else-if="i === 1" class="how__cfd" viewBox="0 0 150 96" fill="none">
              <path d="M2 90 C 40 84, 80 60, 148 30 L148 90 Z" fill="#111110" fill-opacity=".9" />
              <path d="M2 90 C 40 80, 80 44, 148 14 L148 30 C 80 60, 40 84, 2 90 Z" fill="#e85002" />
              <path d="M2 90 C 40 76, 80 30, 148 4 L148 14 C 80 44, 40 80, 2 90 Z" fill="#111110" fill-opacity=".15" />
              <line x1="2" y1="94" x2="148" y2="94" stroke="#111110" stroke-opacity=".25" stroke-width="1.5" />
            </svg>
            <svg v-else viewBox="0 0 150 96" fill="none" stroke-width="1.5">
              <path class="how__line" d="M4 88 Q 80 30 146 8" stroke="#111110" stroke-opacity=".3" />
              <path class="how__line" d="M4 88 Q 80 50 146 40" stroke="#e85002" />
              <path class="how__line" d="M4 88 Q 80 70 146 72" stroke="#111110" stroke-opacity=".3" />
              <circle class="how__dot" cx="146" cy="40" r="4" fill="#e85002" />
              <text x="100" y="58" font-family="JetBrains Mono, monospace" font-size="10" fill="#e85002">85%</text>
            </svg>
          </div>
          <h3>{{ s.title }}</h3>
          <p class="muted">{{ s.text }}</p>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.how { display: grid; grid-template-columns: repeat(3, 1fr); gap: 40px; }
.how__num { font-size: 12px; color: var(--ink-3); }
.how__illo { height: 96px; margin-top: 18px; }
.how__illo svg { height: 100%; width: auto; overflow: visible; }
.how h3 { font-size: 21px; line-height: 1.25; margin: 28px 0 10px; }
.how__moving { transform-box: fill-box; animation: how-move 3.2s var(--ease) infinite; }
.how__dot { transform-box: fill-box; transform-origin: center; animation: how-pulse 1.6s ease-in-out infinite; }

.how__cfd path { animation: how-grow 5s var(--ease) infinite; }
.how__cfd path:nth-of-type(2) { animation-delay: 0.15s; }
.how__cfd path:nth-of-type(3) { animation-delay: 0.3s; }
.how__line { stroke-dasharray: 170; animation: how-draw 4.5s var(--ease) infinite; }
.how__line:nth-of-type(2) { animation-delay: 0.2s; }
.how__line:nth-of-type(3) { animation-delay: 0.4s; }

@keyframes how-grow {
  0% { clip-path: inset(0 100% 0 0); }
  55%, 88% { clip-path: inset(0 0 0 0); }
  100% { clip-path: inset(0 0 0 0); opacity: 0; }
}
@keyframes how-draw {
  0% { stroke-dashoffset: 170; }
  50%, 90% { stroke-dashoffset: 0; opacity: 1; }
  100% { stroke-dashoffset: 0; opacity: 0; }
}
@keyframes how-move {
  0%, 100% { transform: translateX(-52px) rotate(0deg); }
  45%, 70% { transform: translateX(0) rotate(-6deg); }
}
@keyframes how-pulse {
  50% { transform: scale(1.6); }
}

@media (max-width: 900px) {
  .how { grid-template-columns: 1fr; }
  .how__card { text-align: center; }
  .how__illo { display: flex; justify-content: center; }
}
</style>
