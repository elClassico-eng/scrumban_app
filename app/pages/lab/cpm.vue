<script setup lang="ts">
import type { Scope } from 'animejs'
import { createScope, createSpring, createTimeline, stagger, svg, utils } from 'animejs'
import '~/assets/css/landing.css'

type LandingNetwork = {
  horizonDays: number | null
  edgeCount: number
  closedSamples: number
  tasks: {
    taskId: string
    title: string
    storyPoints: number | null
    estimate: { optimisticDays: number, mostLikelyDays: number, pessimisticDays: number }
    expectedDays: number
    earlyStartDays: number
    earlyFinishDays: number
    slackDays: number
    critical: boolean
    dependsOn: string[]
  }[]
  criticalPathIds: string[]
  pert: { expectedDurationDays: number, sigmaDays: number, probabilityWithinHorizon: number | null }
  simulation: { iterations: number, p50Days: number, p85Days: number, p95Days: number, probabilityWithinHorizon: number | null }
}

definePageMeta({ layout: false })
useHead({ bodyAttrs: { class: 'landing-page' }, title: 'CPM / PERT lab' })

const { data } = await useFetch<LandingNetwork>('/api/landing/network')

const VB_W = 920
const VB_H = 240
const NODE_W = 200
const NODE_H = 72

const layout = computed(() => {
  const net = data.value
  if (!net) return null

  const onChain = new Set(net.criticalPathIds)
  const chain = new Set(
    net.criticalPathIds.slice(0, -1).map((id, i) => `${id}->${net.criticalPathIds[i + 1]}`),
  )

  const cols = [...new Set(net.tasks.map(t => t.earlyStartDays))].sort((a, b) => a - b)
  const gap = cols.length > 1 ? (VB_W - 80 - NODE_W) / (cols.length - 1) : 0
  const perCol = new Map<number, number>()

  const nodes = [...net.tasks]
    .sort((a, b) => a.earlyStartDays - b.earlyStartDays
      || Number(onChain.has(b.taskId)) - Number(onChain.has(a.taskId)))
    .map((t) => {
      const ci = cols.indexOf(t.earlyStartDays)
      const row = perCol.get(ci) ?? 0
      perCol.set(ci, row + 1)
      return {
        ...t,
        x: 40 + ci * gap,
        y: 30 + row * 104,
        onChain: onChain.has(t.taskId),
        tight: !onChain.has(t.taskId) && t.critical,
      }
    })

  const byId = new Map(nodes.map(n => [n.taskId, n]))

  const edgePath = (from: typeof nodes[number], to: typeof nodes[number]) => {
    const x1 = from.x + NODE_W
    const y1 = from.y + NODE_H / 2
    const x2 = to.x
    const y2 = to.y + NODE_H / 2
    return `M ${x1} ${y1} C ${x1 + 46} ${y1}, ${x2 - 46} ${y2}, ${x2} ${y2}`
  }

  const edges = nodes.flatMap(to =>
    to.dependsOn
      .map(id => byId.get(id))
      .filter((from): from is typeof nodes[number] => !!from)
      .map(from => ({
        key: `${from.taskId}->${to.taskId}`,
        d: edgePath(from, to),
        critical: chain.has(`${from.taskId}->${to.taskId}`),
      })),
  )

  const route = net.criticalPathIds
    .map(id => byId.get(id))
    .filter((n): n is typeof nodes[number] => !!n)
  const routeD = route.length < 2
    ? ''
    : route.slice(1).reduce(
        (acc, to, i) => `${acc} ${edgePath(route[i]!, to).replace(/^M [\d.]+ [\d.]+ /, '')}`,
        `M ${route[0]!.x + NODE_W} ${route[0]!.y + NODE_H / 2}`,
      )

  return { nodes, edges, routeD }
})

const horizon = computed(() => data.value?.horizonDays ?? 0)
const pertPct = computed(() => Math.round((data.value?.pert.probabilityWithinHorizon ?? 0) * 100))
const mcPct = computed(() => Math.round((data.value?.simulation.probabilityWithinHorizon ?? 0) * 100))

const pertShown = ref(0)
const mcShown = ref(0)
const teShown = ref('0.0')

const root = useTemplateRef<HTMLElement>('root')
const scope = shallowRef<Scope | null>(null)

onMounted(async () => {
  await nextTick()
  const el = root.value
  if (!el || !layout.value) return

  scope.value = createScope({ root: el }).add((self) => {
    const edges = svg.createDrawable('.nw-edge')
    const tl = createTimeline({
      defaults: { ease: 'out(3)' },
      onBegin: () => {
        pertShown.value = 0
        mcShown.value = 0
        teShown.value = '0.0'
      },
    })

    tl.add('.nw-node', {
      opacity: [0, 1],
      scale: [0.86, 1],
      duration: 620,
      delay: stagger(90),
    }, 0)

    tl.add(edges, {
      draw: ['0 0', '0 1'],
      duration: 620,
      delay: stagger(80),
      ease: 'inOut(2)',
    }, 420)

    tl.add('.nw-edge--crit', {
      stroke: '#E85002',
      strokeWidth: 2.6,
      duration: 520,
    }, 1500)

    tl.add('.nw-node--crit .nw-box', {
      stroke: '#E85002',
      strokeWidth: 1.8,
      duration: 520,
      delay: stagger(120),
    }, 1560)

    if (el.querySelector('.nw-node--tight')) {
      tl.add('.nw-node--tight .nw-box', {
        stroke: '#E85002',
        strokeWidth: 1.2,
        duration: 520,
        delay: stagger(120),
      }, 1900)
    }

    tl.add('.nw-runner', { opacity: [0, 1], duration: 200 }, 1900)
    tl.add('.nw-runner', {
      ...svg.createMotionPath('#nw-route'),
      duration: 1500,
      ease: 'inOut(2)',
    }, 2000)
    tl.add('.nw-runner', { opacity: 0, duration: 300 }, 3500)

    tl.add('.nw-slack', {
      opacity: [0, 1],
      scaleX: [0, 1],
      duration: 700,
      ease: createSpring({ stiffness: 80, damping: 14 }),
    }, 2600)

    tl.add({ v: 0 }, {
      v: 1,
      duration: 1100,
      ease: 'out(2)',
      onUpdate: (a) => {
        const k = (a.targets[0] as { v: number }).v
        teShown.value = ((data.value?.pert.expectedDurationDays ?? 0) * k).toFixed(1)
      },
    }, 3200)

    tl.add('.vs-card', {
      opacity: [0, 1],
      translateY: [18, 0],
      duration: 700,
      delay: stagger(160),
    }, 3600)

    tl.add({ v: 0 }, {
      v: 1,
      duration: 1200,
      ease: 'out(3)',
      onUpdate: (a) => {
        const k = (a.targets[0] as { v: number }).v
        pertShown.value = Math.round(pertPct.value * k)
        mcShown.value = Math.round(mcPct.value * k)
      },
    }, 3900)

    tl.add('.vs-fill', {
      scaleX: (_t?: unknown, i?: number) => [0, (i === 0 ? pertPct.value : mcPct.value) / 100],
      duration: 1200,
      ease: 'out(3)',
    }, 3900)

    self!.add('replay', () => tl.restart())

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      tl.pause()
      pertShown.value = pertPct.value
      mcShown.value = mcPct.value
      teShown.value = (data.value?.pert.expectedDurationDays ?? 0).toFixed(1)
      utils.set(['.nw-node', '.vs-card', '.nw-slack', '.nw-runner'], { opacity: 1 })
      utils.set(edges, { draw: '0 1' })
      utils.set('.vs-fill', { scaleX: (_t?: unknown, i?: number) => (i === 0 ? pertPct.value : mcPct.value) / 100 })
    }
  })
})

onBeforeUnmount(() => scope.value?.revert())
</script>

<template>
  <div ref="root" class="landing lab">
    <section class="lab-hero">
      <div class="wrap">
        <div class="chip"><span class="pulse" />CPM / PERT · реальный алгоритм из server/utils</div>

        <h1 class="lab-h1">
          Один спринт. Два метода. <span class="hl">Разные ответы.</span>
        </h1>

        <p class="lab-sub">
          Сеть зависимостей ниже посчитана тем же кодом, что и в продукте: метод критического пути
          даёт ожидаемую длительность {{ teShown }} дня. А дальше PERT и Монте-Карло дают разные
          ответы на вопрос, уложится ли команда в срок.
        </p>

        <div v-if="layout" class="nw-legend">
          <span><i class="dot dot--crit" />критическая цепочка ({{ data?.criticalPathIds.length }} задачи)</span>
          <span v-if="layout.nodes.some(n => n.tight)"><i class="dot dot--tight" />нулевой резерв, но вне цепочки</span>
          <span><i class="dot" />есть резерв</span>
          <span class="nw-meta">по горизонтали – раннее начало (ES)</span>
          <span class="nw-meta">{{ data?.tasks.length }} задач · {{ data?.edgeCount }} связей · σ {{ data?.pert.sigmaDays.toFixed(2) }} дня</span>
          <button class="btn btn--light lab-replay" @click="scope?.methods.replay?.()">Повторить</button>
        </div>
      </div>

      <div class="wrap">
        <svg v-if="layout" class="nw" :viewBox="`0 0 ${VB_W} ${VB_H}`" preserveAspectRatio="xMidYMid meet">
          <path v-if="layout.routeD" id="nw-route" :d="layout.routeD" fill="none" stroke="none" />

          <path
            v-for="e in layout.edges" :key="e.key"
            class="nw-edge" :class="{ 'nw-edge--crit': e.critical }"
            :d="e.d"
          />

          <g
            v-for="n in layout.nodes" :key="n.taskId"
            class="nw-node"
            :class="{ 'nw-node--crit': n.onChain, 'nw-node--tight': n.tight }"
          >
            <rect class="nw-box" :x="n.x" :y="n.y" :width="NODE_W" :height="NODE_H" rx="14" />
            <text class="nw-title" :x="n.x + 16" :y="n.y + 28">
              {{ n.title.length > 24 ? `${n.title.slice(0, 23)}…` : n.title }}
            </text>
            <text class="nw-days" :x="n.x + 16" :y="n.y + 52">Te {{ n.expectedDays.toFixed(1) }} д</text>
            <text v-if="n.tight" class="nw-tag" :x="n.x + NODE_W - 16" :y="n.y + 52">резерв 0</text>
            <g v-if="!n.critical" class="nw-slack">
              <text class="nw-tag" :x="n.x + NODE_W - 16" :y="n.y + 52">резерв {{ n.slackDays.toFixed(1) }} д</text>
              <rect class="nw-slackbar" :x="n.x + 16" :y="n.y + 62" :width="NODE_W - 32" height="4" rx="2" />
            </g>
          </g>

          <circle class="nw-runner" cx="0" cy="0" r="6" opacity="0" />
        </svg>
      </div>

      <div class="wrap">
        <div class="vs">
          <article class="vs-card">
            <p class="eyebrow">PERT · нормальное приближение</p>
            <b class="vs-num">{{ pertShown }}<span>%</span></b>
            <div class="vs-bar"><i class="vs-fill" /></div>
            <span class="vs-note">
              Считает разброс только вдоль одной критической цепочки: Te {{ data?.pert.expectedDurationDays.toFixed(1) }} д, σ {{ data?.pert.sigmaDays.toFixed(2) }} д.
            </span>
          </article>

          <article class="vs-card vs-card--mc">
            <p class="eyebrow">Монте-Карло · {{ data?.simulation.iterations.toLocaleString('ru-RU') }} прогонов</p>
            <b class="vs-num">{{ mcShown }}<span>%</span></b>
            <div class="vs-bar"><i class="vs-fill vs-fill--mc" /></div>
            <span class="vs-note">
              P50 {{ data?.simulation.p50Days.toFixed(1) }} · P85 {{ data?.simulation.p85Days.toFixed(1) }} · P95 {{ data?.simulation.p95Days.toFixed(1) }} д.
              Параллельные ветки тоже могут стать критическими.
            </span>
          </article>
        </div>

        <p class="vs-punch">
          Вероятность уложиться в {{ horizon }} дней: <b>{{ pertPct }}%</b> по PERT против
          <b class="accent">{{ mcPct }}%</b> по симуляции. Классический PERT занижает срок, потому что
          игнорирует, что задержка на любой параллельной ветке способна сдвинуть весь спринт.
        </p>
      </div>
    </section>
  </div>
</template>

<style scoped>
.lab { min-height: 100svh; }
.lab-hero { padding: clamp(36px, 5vw, 64px) 0 clamp(48px, 6vw, 88px); }

.lab-h1 {
  max-width: 22ch;
  margin: 18px 0 0;
  font-family: var(--font-display);
  font-size: clamp(34px, 4.4vw, 58px);
  font-weight: 500;
  line-height: 1.05;
  letter-spacing: -0.03em;
}
.lab-h1 :deep(.hl) { color: var(--orange); }

.lab-sub {
  max-width: 62ch;
  margin-top: 18px;
  font-size: 17px;
  line-height: 1.55;
  color: var(--ink-2);
}

.nw-legend {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px 22px;
  margin-top: 24px;
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--ink-2);
}
.nw-legend span { display: inline-flex; align-items: center; gap: 8px; }
.nw-legend .dot { width: 9px; height: 9px; border-radius: 50%; background: var(--ink-3); }
.nw-legend .dot--crit { background: var(--orange); }
.nw-legend .dot--tight { background: transparent; border: 1.5px solid var(--orange); }
.nw-meta { color: var(--ink-3); }
.lab-replay { height: 38px; padding: 0 16px; font-size: 14px; margin-left: auto; }

.nw {
  display: block;
  width: 100%;
  margin-top: 18px;
  overflow: visible;
}
.nw-node { opacity: 0; transform-box: fill-box; transform-origin: center; }
.nw-box { fill: var(--bg-card); stroke: var(--line); stroke-width: 1; }
.nw-title { fill: var(--ink); font-family: var(--font-body); font-size: 14px; font-weight: 500; }
.nw-days { fill: var(--ink-3); font-family: var(--font-mono); font-size: 11px; }
.nw-edge { fill: none; stroke: var(--ink-3); stroke-width: 1.4; }
.nw-runner { fill: var(--orange); }
.nw-slack { opacity: 0; }
.nw-slackbar { fill: var(--haze-1); }
.nw-tag { fill: var(--ink-3); font-family: var(--font-mono); font-size: 10px; text-anchor: end; }
.nw-node--tight .nw-box { stroke-dasharray: 5 4; }

.vs {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 18px;
  margin-top: 36px;
}
.vs-card {
  opacity: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 24px;
  border: 1px solid var(--line);
  border-radius: var(--r-card);
  background: var(--bg-card);
  box-shadow: var(--shadow-card);
}
.vs-num {
  font-family: var(--font-display);
  font-size: 56px;
  font-weight: 500;
  line-height: 1;
  letter-spacing: -0.03em;
  font-variant-numeric: tabular-nums;
}
.vs-num span { font-size: 24px; color: var(--ink-3); margin-left: 2px; }
.vs-card--mc .vs-num { color: var(--orange); }
.vs-bar { height: 6px; border-radius: 3px; background: var(--haze-3); overflow: hidden; }
.vs-fill {
  display: block;
  height: 100%;
  width: 100%;
  transform: scaleX(0);
  transform-origin: left center;
  background: var(--ink-3);
  border-radius: 3px;
}
.vs-fill--mc { background: var(--orange); }
.vs-note { font-size: 13.5px; line-height: 1.5; color: var(--ink-2); }

.vs-punch {
  max-width: 74ch;
  margin-top: 26px;
  font-size: 16px;
  line-height: 1.6;
  color: var(--ink-2);
}
.vs-punch b { color: var(--ink); font-weight: 500; }
.vs-punch .accent { color: var(--orange); }
</style>
