<script setup lang="ts">
type WhyItem = { chip: 'done' | 'dev' | 'plan', title: string, desc: string }

const WHY: WhyItem[] = [
  { chip: 'done', title: 'Прогноз сроков, а не «на глаз»', desc: 'Monte Carlo и сетевое планирование (CPM/PERT) дают вероятность уложиться и P50/P85/P95 — с доверительным интервалом, а не «успеем / не успеем».' },
  { chip: 'done', title: 'Каждая цифра — с формулой', desc: 'Никаких чёрных ящиков: WIP-рекомендации по закону Литтла, перцентили cycle time, CFD — всё объясняется и проверяется.' },
  { chip: 'done', title: 'Scrumban, а не «ещё один канбан»', desc: 'Спринты задают ритм, поток даёт предсказуемость. Две методологии работают вместе, а не вместо.' },
  { chip: 'done', title: 'Real-time из коробки', desc: 'Доска обновляется у всей команды мгновенно через SSE — без перезагрузок и конфликтов.' },
  { chip: 'done', title: 'Под команды 30+', desc: 'Воркспейсы, роли и изоляция данных на уровне строк (RLS).' },
  { chip: 'plan', title: 'РФ-экосистема и on-prem', desc: 'GitFlic, Pachca, Yandex Cloud, 1С и self-hosting — в планах под российский стек.' },
]

const section = ref<HTMLElement | null>(null)
const sheet = ref<HTMLElement | null>(null)
const inner = ref<HTMLElement | null>(null)
const track = ref<HTMLElement | null>(null)
const fill = ref<HTMLElement | null>(null)
const cur = ref(0)

const pad2 = (n: number) => String(n).padStart(2, '0')

let raf = 0
onMounted(() => {
  const loop = () => {
    raf = requestAnimationFrame(loop)
    const sec = section.value
    const sh = sheet.value
    const inr = inner.value
    const tr = track.value
    if (!sec || !sh || !inr || !tr) return
    if (window.innerWidth <= 880) return

    const rect = sec.getBoundingClientRect()
    const scrollable = sec.offsetHeight - window.innerHeight
    const p = Math.min(1, Math.max(0, -rect.top / scrollable))

    const r = p < 0.14 ? (p / 0.14) * 92 : 92
    sh.style.clipPath = `circle(${r.toFixed(2)}% at 50% 52%)`
    inr.style.opacity = p > 0.12 ? '1' : '0'

    const mid = Math.min(1, Math.max(0, (p - 0.14) / 0.72))
    const maxScroll = tr.scrollWidth - tr.clientWidth
    tr.scrollLeft = mid * maxScroll
    if (fill.value) fill.value.style.width = `${8 + mid * 92}%`
    cur.value = Math.min(WHY.length - 1, Math.floor(mid * WHY.length * 0.999))
  }
  loop()
})
onBeforeUnmount(() => cancelAnimationFrame(raf))
</script>

<template>
  <section id="why" ref="section" class="section why" :style="{ height: '520vh' }">
    <div class="why__pin">
      <div ref="sheet" class="why__sheet" />
      <div ref="inner" class="why__inner">
        <div class="why__bar">
          <div class="why__eyebrow"><span class="ln" />02 — Почему Такт</div>
          <div class="sp" />
          <div class="why__progress"><i ref="fill" /></div>
          <div class="why__count"><b>{{ pad2(cur + 1) }}</b> / 06</div>
        </div>
        <div ref="track" class="why__track">
          <article v-for="(w, i) in WHY" :key="w.title" class="why-panel" :class="{ on: i === cur }">
            <div class="why-panel__num">{{ pad2(i + 1) }}</div>
            <div class="why-panel__body">
              <div class="why-panel__chip"><LandingStatusChip :kind="w.chip" on-light /></div>
              <h3 class="why-panel__title">{{ w.title }}</h3>
              <p class="why-panel__desc">{{ w.desc }}</p>
            </div>
          </article>
        </div>
      </div>
    </div>
  </section>
</template>