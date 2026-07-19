<script setup lang="ts">
type Perk = { icon: string, title: string, desc: string }
type Social = { key: string, label: string, href: string, brand: string, path: string }

const SOCIALS: Social[] = [
  {
    key: 'tg',
    label: 'Telegram автора',
    href: 'https://t.me/paytina4',
    brand: '#229ED9',
    path: 'M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z',
  },
  {
    key: 'vk',
    label: 'ВКонтакте автора',
    href: 'https://vk.ru/yanedlb',
    brand: '#0077FF',
    path: 'M6.79 7.3H4.05c.13 6.24 3.25 9.99 8.72 9.99h.31v-3.57c2.01.2 3.53 1.67 4.14 3.57h2.84c-.78-2.84-2.83-4.41-4.11-5.01 1.28-.74 3.08-2.54 3.51-4.98h-2.58c-.56 1.98-2.22 3.78-3.8 3.95V7.3H10.5v6.92c-1.6-.4-3.62-2.34-3.71-6.92Z',
  },
]

const PERKS: Perk[] = [
  {
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z"/></svg>',
    title: 'Ранний доступ',
    desc: 'Полный функционал бесплатно на всё время апробации.',
  },
  {
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M3 17l5-5 4 4 8-9"/><path d="M16 7h5v5"/></svg>',
    title: 'Влияние на roadmap',
    desc: 'Ваши кейсы напрямую задают приоритеты разработки.',
  },
  {
    icon: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"><path d="M4 5h16v11H7l-3 3V5z"/></svg>',
    title: 'Прямая связь с автором',
    desc: 'Личный канал: баги, идеи и фичи без бюрократии.',
  },
]
</script>

<template>
  <section id="pilots" class="section pilots2">
    <div class="wrap pilots2__grid">
      <article class="pilots2__invite reveal">
        <p class="eyebrow">Пилотам</p>
        <h2>Команда 30+?<br>Влияйте на продукт.</h2>
        <p class="pilots2__lead">Я ищу пилотные команды, готовые попробовать Такт в реальной работе. Не нужно мигрировать всю команду: достаточно одного проекта и честного «что не так». Ваш фидбек идёт прямо в разработку.</p>
        <div class="pilots2__perks">
          <div v-for="p in PERKS" :key="p.title" class="perk">
            <span class="perk__ic" v-html="p.icon" />
            <div>
              <h3>{{ p.title }}</h3>
              <p>{{ p.desc }}</p>
            </div>
          </div>
        </div>
        <a class="btn btn--orange pilots2__cta" href="#cta">Стать пилотной командой</a>
      </article>

      <aside class="pilots2__author reveal">
        <span class="pilots2__photo" aria-hidden="true">ДЧ</span>
        <p class="eyebrow">О проекте</p>
        <p class="pilots2__about">Магистерский проект ВолГУ. Такт родился как исследование: можно ли честно соединить ритм Scrum и поток Kanban и подкрепить это математикой планирования. Сейчас – открытая бета и апробация.</p>
        <div class="pilots2__foot">
          <p class="pilots2__sign"><b>Даниил Черкесов</b><span>автор · ВолГУ 2027</span></p>
          <div class="pilots2__socials">
            <a
              v-for="s in SOCIALS" :key="s.key"
              class="asoc" :class="`asoc--${s.key}`"
              :href="s.href" target="_blank" rel="noopener"
              :style="{ '--brand': s.brand }" :aria-label="s.label"
            >
              <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path :d="s.path" /></svg>
            </a>
          </div>
        </div>
      </aside>
    </div>
  </section>
</template>
