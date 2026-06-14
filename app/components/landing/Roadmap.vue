<script setup lang="ts">
type Phase = { cls: 'now' | 'soon' | 'vision', when: string, chip: 'done' | 'dev' | 'plan', title: string, items: string[][] }

const PHASES: Phase[] = [
  {
    cls: 'now', when: 'Сейчас', chip: 'done', title: 'Фундамент',
    items: [
      ['Канбан-доска, спринты, бэклог'],
      ['Real-time (SSE) и роли с RLS'],
      ['Инвайты по magic-link, воркспейсы'],
    ],
  },
  {
    cls: 'soon', when: 'Скоро', chip: 'dev', title: 'Математика и интеграции',
    items: [
      ['Аналитика потока', ' — CPM/PERT, CFD, прогнозы сроков'],
      ['Нативные интеграции', ' — GitFlic, Pachca, Yandex Cloud, 1С'],
      ['Уведомления и автоматизации потока'],
    ],
  },
  {
    cls: 'vision', when: 'Vision', chip: 'plan', title: 'Полноценный SaaS',
    items: [
      ['Хостинг в Yandex Cloud, данные в РФ'],
      ['Self-hosting on-prem для enterprise'],
      ['Маркетплейс шаблонов и плагинов'],
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
      f.style.height = `${Math.round(l.clientHeight * 0.5)}px`
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