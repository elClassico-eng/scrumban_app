<script setup lang="ts">
type Perk = { icon: string, title: string, desc: string }

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
        <p class="pilots2__sign"><b>Даниил Черкесов</b><span>автор · ВолГУ 2027</span></p>
      </aside>
    </div>
  </section>
</template>
