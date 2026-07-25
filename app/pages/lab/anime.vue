<script setup lang="ts">
import type { Scope } from 'animejs'
import { animate, createScope, createDraggable, createSpring, createTimeline, stagger, svg, text, utils } from 'animejs'
import '~/assets/css/landing.css'

definePageMeta({ layout: false })
useHead({ bodyAttrs: { class: 'landing-page' }, title: 'Anime.js lab' })

type Task = { id: string, o: number, m: number, p: number }

const CHAINS: Task[][] = [
  [
    { id: 'Схема БД', o: 0.5, m: 1, p: 3 },
    { id: 'API задач', o: 1.5, m: 3, p: 6 },
    { id: 'Миграции', o: 0.5, m: 1, p: 2.5 },
  ],
  [
    { id: 'UI доски', o: 2, m: 4, p: 8 },
    { id: 'Drag-n-drop', o: 1, m: 2, p: 5 },
  ],
  [
    { id: 'Отчёт по спринту', o: 2.5, m: 5, p: 11 },
  ],
]

const TRIALS = 1400
const BINS = 48
const DOT_EVERY = 13
const FILL_MS = 3400

const VB_W = 1200
const VB_H = 300
const PLOT_L = 96
const PLOT_R = 1128
const PLOT_TOP = 58
const BASE = 236
const PLOT_W = PLOT_R - PLOT_L
const PLOT_H = BASE - PLOT_TOP

function lcg(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0
    return s / 4294967296
  }
}

function triangular(o: number, m: number, p: number, u: number) {
  const c = (m - o) / (p - o)
  return u < c
    ? o + Math.sqrt(u * (p - o) * (m - o))
    : p - Math.sqrt((1 - u) * (p - o) * (p - m))
}

const rnd = lcg(20260725)
const samples: number[] = []
for (let t = 0; t < TRIALS; t++) {
  let critical = 0
  for (const chain of CHAINS) {
    let sum = 0
    for (const task of chain) sum += triangular(task.o, task.m, task.p, rnd())
    if (sum > critical) critical = sum
  }
  samples.push(critical)
}

const sorted = [...samples].sort((a, b) => a - b)
const quantile = (q: number) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]!

const lo = Math.floor(sorted[0]!)
const hi = Math.ceil(sorted[sorted.length - 1]!)
const span = hi - lo

const binOf = samples.map(v => utils.clamp(Math.floor((v - lo) / span * BINS), 0, BINS - 1))
const finalCounts = new Array<number>(BINS).fill(0)
for (const b of binOf) finalCounts[b]!++
const peak = Math.max(...finalCounts)

const barW = PLOT_W / BINS
const xOfDay = (d: number) => PLOT_L + (d - lo) / span * PLOT_W

const p85 = quantile(0.85)
const p95 = quantile(0.95)

const bars = Array.from({ length: BINS }, (_, i) => {
  const day = lo + (i + 0.5) / BINS * span
  return {
    x: PLOT_L + i * barW + 1,
    w: Math.max(1, barW - 2),
    zone: day <= p85 ? 'safe' : day <= p95 ? 'watch' : 'risk',
  }
})

const rain: { x: number, y: number, d: number }[] = []
const running = new Array<number>(BINS).fill(0)
for (let k = 0; k < TRIALS; k++) {
  const b = binOf[k]!
  running[b]!++
  if (k % DOT_EVERY === 0) {
    rain.push({
      x: PLOT_L + b * barW + barW / 2,
      y: BASE - running[b]! / peak * PLOT_H - 4,
      d: (k / TRIALS) * FILL_MS,
    })
  }
}

const MARKS = [
  { q: 0.5, label: 'P50', day: quantile(0.5) },
  { q: 0.85, label: 'P85', day: quantile(0.85) },
  { q: 0.95, label: 'P95', day: quantile(0.95) },
]
const median = quantile(0.5)

const ticks = Array.from({ length: Math.floor(span / 2) + 1 }, (_, i) => lo + i * 2).filter(d => d <= hi)

const trialsShown = ref(0)
const dayLabels = ref(MARKS.map(() => '–'))
const nf = new Intl.NumberFormat('ru-RU')

const root = useTemplateRef<HTMLElement>('root')
const scope = shallowRef<Scope | null>(null)

onMounted(() => {
  const el = root.value
  if (!el) return

  scope.value = createScope({ root: el }).add((self) => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches

    const barEls = Array.from(el.querySelectorAll<SVGRectElement>('.mc-bar'))
    const axis = svg.createDrawable('.mc-axis')
    const headline = text.splitText('.mc-h1', { words: true, chars: false })

    const paint = (upTo: number) => {
      const counts = new Array<number>(BINS).fill(0)
      for (let k = 0; k < upTo; k++) counts[binOf[k]!]!++
      for (let b = 0; b < BINS; b++) {
        const h = counts[b]! / peak * PLOT_H
        barEls[b]!.setAttribute('height', String(h))
        barEls[b]!.setAttribute('y', String(BASE - h))
      }
    }

    let cursor = 0
    const counts = new Array<number>(BINS).fill(0)
    const feed = { i: 0 }

    const tl = createTimeline({
      defaults: { ease: 'out(3)' },
      onBegin: () => {
        cursor = 0
        counts.fill(0)
        trialsShown.value = 0
        dayLabels.value = MARKS.map(() => '–')
        paint(0)
      },
    })

    tl.add(headline.words, {
      opacity: [0, 1],
      translateY: [26, 0],
      filter: ['blur(6px)', 'blur(0px)'],
      duration: 900,
      delay: stagger(55),
    }, 0)

    tl.add(axis, { draw: ['0 0', '0 1'], duration: 800, ease: 'inOut(2)' }, 200)

    tl.add('.mc-tick', { opacity: [0, 1], duration: 400, delay: stagger(28) }, 600)

    tl.add(feed, {
      i: TRIALS,
      duration: FILL_MS,
      ease: 'linear',
      modifier: utils.round(0),
      onUpdate: () => {
        const target = feed.i
        while (cursor < target) {
          const b = binOf[cursor]!
          counts[b]!++
          const h = counts[b]! / peak * PLOT_H
          barEls[b]!.setAttribute('height', String(h))
          barEls[b]!.setAttribute('y', String(BASE - h))
          cursor++
        }
        trialsShown.value = target
      },
    }, 700)

    tl.add('.mc-drop', {
      opacity: [{ to: 0.9, duration: 120 }, { to: 0, duration: 260, delay: 420 }],
      cy: (_t?: unknown, i?: number) => rain[i!]!.y,
      r: [0, 3.4],
      duration: 800,
      ease: 'in(2)',
      delay: (_t?: unknown, i?: number) => rain[i!]!.d,
    }, 700)

    tl.add('.mc-mark', {
      opacity: [0, 1],
      translateX: (_t?: unknown, i?: number) => [xOfDay(median), xOfDay(MARKS[i!]!.day)],
      scaleY: [0.2, 1],
      duration: 1400,
      ease: createSpring({ stiffness: 70, damping: 13 }),
      delay: stagger(120),
    }, FILL_MS + 200)

    tl.add({ v: 0 }, {
      v: 1,
      duration: 900,
      ease: 'out(2)',
      onUpdate: (a) => {
        const k = (a.targets[0] as { v: number }).v
        dayLabels.value = MARKS.map(m => `${(lo + (m.day - lo) * k).toFixed(1)} д`)
      },
    }, FILL_MS + 400)

    self!.add('replay', () => tl.restart())

    if (reduced) {
      tl.pause()
      paint(TRIALS)
      trialsShown.value = TRIALS
      dayLabels.value = MARKS.map(m => `${m.day.toFixed(1)} д`)
      utils.set('.mc-mark', { opacity: 1, translateX: (_t?: unknown, i?: number) => xOfDay(MARKS[i!]!.day) })
      utils.set(headline.words, { opacity: 1 })
      utils.set('.mc-tick', { opacity: 1 })
      utils.set(axis, { draw: '0 1' })
    }
  })

  scope.value.add(() => {
    const edges = svg.createDrawable('.cpm-edge')
    const cpm = createTimeline({ loop: true, defaults: { ease: 'inOut(2)' } })
    cpm.add(edges, { draw: ['0 0', '0 1'], duration: 900, delay: stagger(110) }, 0)
    cpm.add('.cpm-crit', { stroke: '#E85002', strokeWidth: 2.4, duration: 600 }, 1400)
    cpm.add('.cpm-node--crit', { fill: '#E85002', scale: [1, 1.25, 1], duration: 700, delay: stagger(140) }, 1500)
    cpm.add('.cpm-runner', { opacity: [0, 1], duration: 200 }, 2200)
    cpm.add('.cpm-runner', {
      ...svg.createMotionPath('#cpm-route'),
      duration: 1800,
      ease: 'inOut(3)',
    }, 2300)
    cpm.add(['.cpm-edge', '.cpm-node--crit', '.cpm-runner'], { opacity: 0, duration: 500 }, 4600)

    const grid: [number, number] = [4, 3]
    animate('.tile', {
      scale: [{ to: 1.18, duration: 380 }, { to: 1, duration: 620 }],
      backgroundColor: [{ to: '#E85002', duration: 380 }, { to: '#EFEBE5', duration: 620 }],
      delay: stagger(90, { grid, from: 'center' }),
      loop: true,
      loopDelay: 700,
    })

    createDraggable('.throw-card', {
      container: '.throw-zone',
      containerPadding: 10,
      releaseEase: createSpring({ stiffness: 120, damping: 16 }),
      snap: [0, 152, 304],
    })
  })
})

onBeforeUnmount(() => scope.value?.revert())
</script>

<template>
  <div ref="root" class="landing lab">
    <section class="lab-hero">
      <div class="wrap">
        <div class="chip"><span class="pulse" />Anime.js v4 · демо, не в проде</div>

        <h1 class="mc-h1 lab-h1">
          Сроки спринта – <span class="hl">с вероятностью</span>, а не на глаз.
        </h1>

        <p class="lab-sub">
          Это не картинка. Внизу прямо сейчас идёт {{ nf.format(TRIALS) }} прогонов Монте-Карло
          по трём цепочкам задач с PERT-оценками. Гистограмма – их распределение,
          P50/P85/P95 – реальные квантили.
        </p>

        <div class="lab-readout">
          <div class="lab-counter">
            <b>{{ nf.format(trialsShown) }}</b>
            <span>прогонов</span>
          </div>
          <div v-for="(m, i) in MARKS" :key="m.label" class="lab-stat">
            <b>{{ dayLabels[i] }}</b>
            <span>{{ m.label }}</span>
          </div>
          <button class="btn btn--light lab-replay" @click="scope?.methods.replay?.()">
            Повторить
          </button>
        </div>
      </div>

      <svg class="mc" :viewBox="`0 0 ${VB_W} ${VB_H}`" preserveAspectRatio="xMidYMax meet" aria-hidden="true">
        <g class="mc-bars">
          <rect
            v-for="(b, i) in bars" :key="i"
            class="mc-bar" :class="`mc-bar--${b.zone}`"
            :x="b.x" :width="b.w" :y="BASE" height="0" rx="1.5"
          />
        </g>

        <line class="mc-axis" :x1="PLOT_L - 12" :y1="BASE" :x2="PLOT_R + 12" :y2="BASE" />

        <g class="mc-ticks">
          <text v-for="d in ticks" :key="d" class="mc-tick" :x="xOfDay(d)" :y="BASE + 26">{{ d }}</text>
        </g>

        <circle
          v-for="(p, i) in rain" :key="`d${i}`"
          class="mc-drop" :cx="p.x" cy="-24" r="0"
        />

        <g v-for="(m, i) in MARKS" :key="m.label" class="mc-mark" :class="`mc-mark--${i}`">
          <line x1="0" :y1="BASE" x2="0" :y2="PLOT_TOP - 4" />
          <rect x="-30" :y="PLOT_TOP - 34" width="60" height="26" rx="13" />
          <text x="0" :y="PLOT_TOP - 16" text-anchor="middle">{{ m.label }}</text>
        </g>
      </svg>
    </section>

    <section class="section lab-more">
      <div class="wrap">
        <p class="eyebrow">Что ещё умеет либа</p>
        <h2 class="lab-h2">Три механики под наши экраны</h2>

        <div class="lab-grid">
          <article class="lab-card">
            <svg viewBox="0 0 320 170" class="cpm" aria-hidden="true">
              <path id="cpm-route" d="M40 130 L110 130 L110 60 L200 60 L280 60" fill="none" stroke="none" />
              <path class="cpm-edge" d="M40 130 L110 130" />
              <path class="cpm-edge cpm-crit" d="M110 130 L110 60" />
              <path class="cpm-edge" d="M40 130 L110 130" />
              <path class="cpm-edge cpm-crit" d="M110 60 L200 60" />
              <path class="cpm-edge" d="M110 130 L200 130" />
              <path class="cpm-edge cpm-crit" d="M200 60 L280 60" />
              <path class="cpm-edge" d="M200 130 L280 60" />
              <circle class="cpm-node" cx="40" cy="130" r="7" />
              <circle class="cpm-node cpm-node--crit" cx="110" cy="60" r="7" />
              <circle class="cpm-node" cx="200" cy="130" r="7" />
              <circle class="cpm-node cpm-node--crit" cx="200" cy="60" r="7" />
              <circle class="cpm-node cpm-node--crit" cx="280" cy="60" r="7" />
              <circle class="cpm-runner" cx="0" cy="0" r="5" opacity="0" />
            </svg>
            <b>Критический путь</b>
            <span>Рёбра графа рисуются сами (SVG drawable), критическая цепочка загорается, по ней бежит маркер вдоль motion path. Прямая иллюстрация CPM.</span>
          </article>

          <article class="lab-card">
            <div class="tiles">
              <i v-for="i in 12" :key="i" class="tile" />
            </div>
            <b>Каскад по сетке</b>
            <span>Stagger с параметром grid и точкой отсчёта. Для доски: массовое изменение статуса, применение фильтра, перестройка колонок.</span>
          </article>

          <article class="lab-card">
            <div class="throw-zone">
              <i class="throw-slot" /><i class="throw-slot" /><i class="throw-slot" />
              <div class="throw-card">Задача</div>
            </div>
            <b>Бросок со снапом</b>
            <span>Draggable с инерцией, пружиной и привязкой к колонкам. Не замена vuedraggable, а физика поверх неё.</span>
          </article>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lab {
  min-height: 100svh;
}

.lab-hero {
  position: relative;
  padding: clamp(36px, 5vw, 64px) 0 0;
}

.lab-h1 {
  max-width: 20ch;
  margin: 18px 0 0;
  font-family: var(--font-display);
  font-size: clamp(34px, 4.6vw, 62px);
  font-weight: 500;
  line-height: 1.04;
  letter-spacing: -0.03em;
}
.lab-h1 :deep(.hl) { color: var(--orange); }
.lab-h1 :deep(.word) { display: inline-block; will-change: transform, filter; }

.lab-sub {
  max-width: 58ch;
  margin-top: 20px;
  font-size: 17px;
  line-height: 1.55;
  color: var(--ink-2);
}

.lab-readout {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 28px;
  margin-top: 28px;
}
.lab-counter, .lab-stat {
  display: flex;
  flex-direction: column;
  gap: 2px;
  font-family: var(--font-mono);
}
.lab-counter b { font-size: 26px; font-weight: 500; font-variant-numeric: tabular-nums; }
.lab-stat b { font-size: 26px; font-weight: 500; color: var(--orange); font-variant-numeric: tabular-nums; }
.lab-counter span, .lab-stat span {
  font-size: 11px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--ink-3);
}
.lab-replay { height: 40px; padding: 0 18px; font-size: 14px; margin-left: auto; }

.mc {
  display: block;
  width: 100%;
  max-width: var(--maxw);
  margin: 4px auto 0;
  padding: 0 var(--gut);
  overflow: visible;
}
.mc-bar { fill: var(--haze-1); }
.mc-bar--safe { fill: #FFCDAF; }
.mc-bar--watch { fill: #FFE3D2; }
.mc-bar--risk { fill: #EDE7E0; }
.mc-axis { stroke: var(--line); stroke-width: 1.5; }
.mc-tick {
  fill: var(--ink-3);
  font-family: var(--font-mono);
  font-size: 11px;
  text-anchor: middle;
}
.mc-drop { fill: var(--orange); }
.mc-mark { opacity: 0; }
.mc-mark line { stroke: var(--ink); stroke-width: 1.2; stroke-dasharray: 3 4; }
.mc-mark rect { fill: var(--dark); }
.mc-mark text { fill: #fff; font-family: var(--font-mono); font-size: 12px; }
.mc-mark--1 rect, .mc-mark--2 rect { fill: var(--orange); }

.lab-more { border-top: 1px solid var(--line); margin-top: 40px; }
.lab-h2 { margin: 10px 0 40px; }

.lab-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 20px;
}
.lab-card {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 22px;
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}
.lab-card b { font-family: var(--font-display); font-size: 19px; font-weight: 500; margin-top: 8px; }
.lab-card > span { font-size: 14px; line-height: 1.5; color: var(--ink-2); }

.cpm { width: 100%; height: 170px; }
.cpm-edge { fill: none; stroke: var(--ink-3); stroke-width: 1.4; }
.cpm-node { fill: var(--ink-3); }
.cpm-runner { fill: var(--orange); }

.tiles {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 8px;
  height: 170px;
  align-content: center;
}
.tile { display: block; height: 34px; border-radius: 8px; background: #EFEBE5; }

.throw-zone {
  position: relative;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
  height: 170px;
  padding: 10px;
  border-radius: 16px;
  background: var(--haze-3);
}
.throw-slot { border: 1px dashed var(--line); border-radius: 12px; }
.throw-card {
  position: absolute;
  top: 62px;
  left: 12px;
  display: grid;
  place-items: center;
  width: 132px;
  height: 46px;
  border-radius: 12px;
  background: var(--dark);
  color: #fff;
  font-size: 14px;
  cursor: grab;
  user-select: none;
}
.throw-card:active { cursor: grabbing; }
</style>
