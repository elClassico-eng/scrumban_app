<script setup lang="ts">
type Phase = { cls: 'now' | 'soon' | 'vision', when: string, chip: 'done' | 'dev' | 'plan', title: string, items: string[][] }

const PHASES: Phase[] = [
  {
    cls: 'now', when: 'Сейчас', chip: 'done', title: 'Рабочий продукт',
    items: [
      ['Доска, спринты, WIP-лимиты, классы обслуживания'],
      ['Аналитика потока', ' — CFD, cycle time, throughput'],
      ['Прогноз сроков', ' — Monte Carlo, CPM/PERT'],
      ['Real-time (SSE), роли и изоляция данных (RLS)'],
    ],
  },
  {
    cls: 'soon', when: 'Скоро', chip: 'dev', title: 'Интеграции и полировка',
    items: [
      ['Нативные интеграции', ' — GitFlic, Pachca, Yandex Cloud, 1С'],
      ['Уведомления и автоматизации потока'],
      ['Редизайн аналитики и онбординг'],
    ],
  },
]

const line = ref<HTMLElement | null>(null)
const fill = ref<HTMLElement | null>(null)

let raf = 0
let done = false
onMounted(() => {
  const loop = () => {
    raf = requestAnimationFrame(loop)
    const l = line.value
    const f = fill.value
    if (!l || !f) return
    const rect = l.getBoundingClientRect()
    if (!done && rect.top < window.innerHeight * 0.8 && rect.bottom > 0) {
      done = true
      const rmap = l.parentElement
      const phases = rmap ? [...rmap.querySelectorAll<HTMLElement>('.rphase')] : []
      const first = phases[0]
      if (first) {
        const dotCenter = (p: HTMLElement) => {
          const dot = p.querySelector('.rphase__dot')
          if (!dot) return 0
          const r = dot.getBoundingClientRect()
          return r.top + r.height / 2 - rect.top
        }
        const firstY = dotCenter(first)
        const pending = phases.find(p => !p.classList.contains('now'))
        const targetY = dotCenter(pending ?? phases[phases.length - 1] ?? first)
        f.style.top = `${Math.max(0, firstY)}px`
        f.style.height = `${Math.max(0, targetY - firstY)}px`
      }
    }
  }
  loop()
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <section id="roadmap" class="section roadmap section--light">
    <div class="roadmap__glow" />
    <div class="wrap">
      <div class="roadmap__head reveal">
        <div class="section__tag center"><span class="n">04</span> — Куда движемся</div>
        <h2>Честный <span class="o">roadmap</span></h2>
      </div>

      <div class="rmap">
        <div ref="line" class="rmap__spine"><i ref="fill" /></div>
        <div
          v-for="(ph, i) in PHASES" :key="ph.cls"
          class="rphase reveal" :class="ph.cls" :style="{ transitionDelay: `${i * 0.1}s` }"
        >
          <div class="rphase__dot" />
          <div class="rphase__meta">
            <div class="rphase__when">{{ ph.when }}</div>
            <div class="rphase__chip"><LandingStatusChip :kind="ph.chip" /></div>
          </div>
          <div class="rphase__main">
            <h3 class="rphase__title">{{ ph.title }}</h3>
            <div class="rphase__items">
              <div v-for="(it, j) in ph.items" :key="j" class="rphase__item">
                <span class="pico" />
                <span><b>{{ it[0] }}</b>{{ it[1] || '' }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>