<script setup lang="ts">
import { DEMO_SCENES } from '~/utils/landing-content'

const POSTER_SCENE_MS = 6000

const active = ref(0)
const progress = ref(0)
const reduced = ref(false)
const videos = ref<(HTMLVideoElement | null)[]>([])

let raf = 0
let startedAt = 0

function stopTimer() {
  cancelAnimationFrame(raf)
}

function runPosterTimer() {
  stopTimer()
  startedAt = performance.now()
  const tick = (now: number) => {
    progress.value = Math.min(1, (now - startedAt) / POSTER_SCENE_MS)
    if (progress.value >= 1) next()
    else raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

function play(index: number) {
  active.value = index
  progress.value = 0
  videos.value.forEach((v, i) => {
    if (!v) return
    if (i === index && !reduced.value) {
      v.currentTime = 0
      v.play().catch(() => {})
    }
    else v.pause()
  })
  if (reduced.value) return
  if (videos.value[index]) stopTimer()
  else runPosterTimer()
}

function next() {
  play((active.value + 1) % DEMO_SCENES.length)
}

function onTime(i: number, e: Event) {
  if (i !== active.value) return
  const v = e.target as HTMLVideoElement
  if (v.duration) progress.value = v.currentTime / v.duration
}

onMounted(() => {
  reduced.value = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  play(0)
})
onBeforeUnmount(stopTimer)
</script>

<template>
  <div class="demo">
    <div class="demo__stage">
      <div
        v-for="(s, i) in DEMO_SCENES"
        :key="s.id"
        class="demo__scene"
        :class="{ on: i === active }"
        :aria-hidden="i !== active"
      >
        <video
          v-if="s.video"
          :ref="el => (videos[i] = el as HTMLVideoElement | null)"
          :poster="s.poster"
          muted
          playsinline
          :preload="i === 0 ? 'auto' : 'none'"
          @timeupdate="onTime(i, $event)"
          @ended="i === active && next()"
        >
          <source :src="`${s.video}.webm`" type="video/webm">
          <source :src="`${s.video}.mp4`" type="video/mp4">
        </video>
        <img v-else :src="s.poster" :alt="s.title" :loading="i === 0 ? 'eager' : 'lazy'">
      </div>
    </div>
    <div class="demo__tabs" role="tablist" aria-label="Как работает Такт">
      <button
        v-for="(s, i) in DEMO_SCENES"
        :key="s.id"
        type="button"
        role="tab"
        class="demo__tab"
        :class="{ on: i === active, done: i < active }"
        :aria-selected="i === active"
        @click="play(i)"
      >
        <span class="demo__bar"><span :style="{ width: i === active ? `${progress * 100}%` : i < active ? '100%' : '0%' }" /></span>
        <b>{{ s.title }}</b>
      </button>
    </div>
  </div>
</template>

<style scoped>
.demo { margin-top: 64px; border-radius: 28px; background: var(--soft); overflow: hidden; }
.demo__stage { position: relative; aspect-ratio: 1440 / 900; margin: 28px 28px 0; }
.demo__scene {
  position: absolute;
  inset: 0;
  opacity: 0;
  transition: opacity 0.6s var(--ease);
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 20px 60px -30px rgba(0, 0, 0, 0.35);
  background: #fff;
}
.demo__scene.on { opacity: 1; }
.demo__scene :is(img, video) { display: block; width: 100%; height: 100%; object-fit: cover; object-position: top left; }
.demo__tabs { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; padding: 22px 28px 26px; text-align: left; }
.demo__tab { border: 0; padding: 0; background: none; text-align: left; cursor: pointer; color: var(--ink-3); transition: color 0.2s; }
.demo__tab:hover, .demo__tab.on { color: var(--ink); }
.demo__tab b { display: block; margin-top: 10px; font: 500 15px/1.3 var(--font-display); }
.demo__bar { display: block; height: 2px; border-radius: 2px; background: var(--line); overflow: hidden; }
.demo__bar span { display: block; height: 100%; background: var(--ink); }

@media (max-width: 760px) {
  .demo { margin-top: 40px; border-radius: 20px; }
  .demo__stage { margin: 16px 16px 0; }
  .demo__tabs { display: flex; overflow-x: auto; scroll-snap-type: x mandatory; padding: 18px 16px 20px; gap: 16px; }
  .demo__tab { flex: 0 0 72%; scroll-snap-align: start; }
}
</style>
