<script setup lang="ts">
type MiniFeature = { icon: string, title: string, desc: string }

const MINI: MiniFeature[] = [
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18M15 3v12"/></svg>',
    title: 'Доска и WIP-лимиты',
    desc: 'Колонки, лимиты с алертами, классы обслуживания, drag-n-drop.',
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9"/><path d="M3 3v6h6"/></svg>',
    title: 'Спринты по кругу',
    desc: 'Планирование с прогнозом, дейли-дайджест, ретро, неизменяемый отчёт.',
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M9 3h6M10 3v6l-5 8a2 2 0 0 0 1.7 3h10.6A2 2 0 0 0 19 17l-5-8V3"/></svg>',
    title: 'Симулятор what-if',
    desc: 'Проверьте решение до его принятия: оценки, зависимости, дедлайн.',
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
    title: 'Real-time и роли',
    desc: 'Мгновенные обновления (SSE), пять ролей, изоляция данных (RLS).',
  },
]
</script>

<template>
  <section id="product" class="section product">
    <div class="wrap">
      <div class="product__head reveal">
        <p class="eyebrow">Что уже работает</p>
        <h2>Не обещания,<br>а рабочий продукт</h2>
        <p class="product__sub">Всё ниже уже работает в открытой бете.</p>
      </div>

      <div class="product__big reveal">
        <article class="pcard pcard--a">
          <p class="eyebrow">Прогноз сроков</p>
          <div class="pcard__num">5000</div>
          <p class="pcard__note">симуляций Monte Carlo на каждый прогноз</p>
          <p class="pcard__desc">Monte Carlo по сети зависимостей, критический путь и резервы по задачам. Честное «мало истории», когда данных не хватает.</p>
          <LandingShot src="/landing/forecast.webp" alt="Симулятор Такта: вероятность успеть, P50/P85, критический путь спринта" />
        </article>
        <article class="pcard pcard--b">
          <p class="eyebrow">Аналитика потока</p>
          <p class="pcard__desc pcard__desc--top">CFD, cycle time с перцентилями, throughput. Всё считается из событий перехода задач, а не из ручных оценок.</p>
          <LandingShot src="/landing/analytics.webp" alt="Аналитика Такта: cumulative flow diagram и обзор потока" />
        </article>
      </div>

      <div class="product__mini reveal">
        <article v-for="f in MINI" :key="f.title" class="mcard">
          <span class="mcard__ic" v-html="f.icon" />
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
