<script setup lang="ts">
type Source = {
  key: string
  label: string
  desc: string
  detail: string
  icon: string
  area: string
  curvature: number
  place: 'top' | 'bottom'
  align: 'left' | 'right'
}

const STAGGER = 0.55
const DURATION = 3.4

const SOURCES: Source[] = [
  {
    key: 'events',
    label: 'События задач',
    desc: 'Журнал переходов между колонками',
    detail: 'Каждый переход задачи между колонками пишется в неизменяемый журнал. Из него восстанавливаются моменты старта и закрытия — время считается само, без ручного трекинга.',
    area: 's0',
    curvature: 42,
    place: 'top',
    align: 'left',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12h4l2 7 4-14 2 7h6"/></svg>',
  },
  {
    key: 'cycle',
    label: 'История cycle time',
    desc: 'Закрытые задачи за 90 дней',
    detail: 'По закрытым за 90 дней задачам берётся фактическое время от создания до закрытия. Это распределение показывает, сколько задачи реально занимают у вашей команды.',
    area: 's1',
    curvature: -42,
    place: 'bottom',
    align: 'left',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  },
  {
    key: 'estimates',
    label: 'Оценки задач',
    desc: 'Story points и PERT-оценки',
    detail: 'Story points переводятся в дни по истории, а где задана ручная PERT-оценка (оптимистичная / реалистичная / пессимистичная) — берётся она. У каждой задачи получается распределение длительности, а не одна цифра.',
    area: 's2',
    curvature: 42,
    place: 'top',
    align: 'right',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v2M12 19v2M3 12h2M19 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4"/><circle cx="12" cy="12" r="4"/></svg>',
  },
  {
    key: 'deps',
    label: 'Сеть зависимостей',
    desc: 'Критический путь (CPM)',
    detail: 'Блокировки между задачами образуют граф. Метод критического пути (CPM) находит цепочку, которая определяет срок всего спринта — параллельные задачи не складываются вслепую.',
    area: 's3',
    curvature: -42,
    place: 'bottom',
    align: 'right',
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="6" cy="6" r="2.5"/><circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="12" r="2.5"/><path d="M8.5 6.7 15.6 11M8.5 17.3 15.6 13"/></svg>',
  },
]

const containerEl = ref<HTMLElement>()
const centerEl = ref<HTMLElement>()
const sourceEls = ref<(HTMLElement | undefined)[]>([])
const ready = ref(false)

function setSource(i: number, el: unknown) {
  sourceEls.value[i] = (el as HTMLElement | null) ?? undefined
}

onMounted(async () => {
  await nextTick()
  ready.value = true
})
</script>

<template>
  <section id="forecast-flow" class="section fflow">
    <div class="wrap">
      <div class="fflow__head reveal">
        <p class="eyebrow">Прозрачность</p>
        <h2>Откуда берётся прогноз</h2>
        <p class="fflow__sub">Никакой магии: вероятность срока считается из данных, которые команда и так создаёт в работе.</p>
      </div>

      <div ref="containerEl" class="fflow__diagram">
        <template v-if="ready">
          <LandingAnimatedBeam
            v-for="(s, i) in SOURCES" :key="s.key"
            :container="containerEl" :from="sourceEls[i]" :to="centerEl"
            :curvature="s.curvature" :delay="i * STAGGER" :duration="DURATION"
          />
        </template>

        <div class="fflow__grid">
          <div
            v-for="(s, i) in SOURCES" :key="s.key"
            :ref="el => setSource(i, el)"
            class="fnode fnode--src" :style="{ gridArea: s.area }"
            tabindex="0" :aria-label="`${s.label}: ${s.detail}`"
          >
            <span class="fnode__ic" v-html="s.icon" />
            <span class="fnode__text">
              <b>{{ s.label }}</b>
              <span>{{ s.desc }}</span>
            </span>
            <span class="fpop" :class="[`fpop--${s.place}`, `fpop--${s.align}`]" role="tooltip">
              <b class="fpop__title">{{ s.label }}</b>
              <span class="fpop__body">{{ s.detail }}</span>
            </span>
          </div>

          <div ref="centerEl" class="fnode fnode--center" style="grid-area: c">
            <span class="fnode__ic fnode__ic--accent">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3v18h18"/><path d="M7 15l3-4 3 2 4-6"/></svg>
            </span>
            <b>Прогноз спринта</b>
            <span class="fnode__meta">Monte Carlo · P50 / P85 / P95</span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>
