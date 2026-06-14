<script setup lang="ts">
type Perk = { icon: string, t: string, d: string }

const PERKS: Perk[] = [
  { icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>', t: 'Ранний доступ', d: 'Полный функционал бесплатно на всё время апробации.' },
  { icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-9"/><path d="M16 7h5v5"/></svg>', t: 'Влияние на roadmap', d: 'Ваши кейсы напрямую задают приоритеты разработки.' },
  { icon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16v11H7l-3 3V5z"/></svg>', t: 'Прямая связь с автором', d: 'Личный канал: баги, идеи и фичи без бюрократии.' },
]
</script>

<template>
  <section id="pilots" class="section pilots section--light">
    <div class="wrap">
      <div class="pilots__head reveal">
        <div>
          <div class="section__tag"><span class="n">05</span> — Пилотам</div>
          <h2>Команда 30+? <span class="o">Влияй</span> на продукт.</h2>
        </div>
        <p>Мы ищем пилотные команды, готовые попробовать ScrumBan в реальной работе и формировать его вместе с нами. Это не «бета ради галочки» — ваш фидбек идёт прямо в разработку.</p>
      </div>

      <div class="pilots2 reveal">
        <article v-for="(p, i) in PERKS" :key="p.t" class="pstep">
          <div class="pstep__bignum">{{ i + 1 }}</div>
          <div class="pstep__ic" v-html="p.icon" />
          <div class="pstep__k">Что получаете</div>
          <h3>{{ p.t }}</h3>
          <p>{{ p.d }}</p>
        </article>
      </div>

      <div class="pilots2__foot reveal">
        <a class="btn btn--primary btn--static" href="#cta">
          Стать пилотной командой
          <svg class="arr" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 12 4M6 4h6v6" /></svg>
        </a>
        <span class="note">Обсудим формат под вашу команду — без обязательств.</span>
      </div>
    </div>
  </section>
</template>