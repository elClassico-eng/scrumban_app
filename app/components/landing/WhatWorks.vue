<script setup lang="ts">
type WorkItem = { t: string, d: string, slot: string, ph: string }

const WORKS: WorkItem[] = [
  { t: 'Аналитика потока', d: 'CFD, scatter cycle time с перцентилями, throughput — всё считается из событий перехода задач, а не из ручных оценок.', slot: 'w-analytics', ph: 'Скриншот аналитики' },
  { t: 'Прогноз сроков: Monte Carlo + CPM/PERT', d: 'Вероятность уложиться в спринт, P50/P85/P95, критический путь и резервы по задачам — с честным «мало истории», когда данных не хватает.', slot: 'w-forecast', ph: 'Скриншот прогноза' },
  { t: 'Канбан-доска с WIP-лимитами', d: 'Колонки, лимиты WIP с алертами, классы обслуживания, drag-n-drop, фильтры и быстрые действия.', slot: 'w-board', ph: 'Скриншот доски' },
  { t: 'Спринты и бэклог', d: 'Планирование спринтов, перенос задач между ними, добавление из бэклога в один клик.', slot: 'w-sprints', ph: 'Скриншот спринтов' },
  { t: 'Real-time через SSE', d: 'Доска и задачи обновляются у всей команды мгновенно — без перезагрузок и конфликтов.', slot: 'w-rt', ph: 'Скриншот real-time' },
  { t: 'Воркспейсы, роли, RLS', d: 'Несколько команд в одном аккаунте, роли от владельца до наблюдателя, изоляция данных на уровне строк базы.', slot: 'w-members', ph: 'Скриншот ролей' },
]

const active = ref(0)
const current = computed(() => WORKS[active.value])
const pad2 = (n: number) => String(n).padStart(2, '0')
</script>

<template>
  <section id="what" class="section what section--light">
    <div class="wrap">
      <div class="what__head reveal" style="text-align: left; margin-bottom: 44px;">
        <div class="section__tag"><span class="n">03</span> — Что уже работает <span class="ln" /></div>
        <h2 style="margin: 14px 0 0; max-width: 20ch;">Не обещания, а <span class="o">рабочий продукт</span></h2>
      </div>

      <div class="works2 reveal">
        <div class="works2__stage">
          <div class="works2__num">{{ pad2(active + 1) }}<span class="of">/ 06 · готово</span></div>
          <div class="works2__media">
            <LandingImageSlot :key="current!.slot" :placeholder="current!.ph" shape="rounded" :radius="18" />
          </div>
          <div class="works2__cap-body">
            <h3>{{ current!.t }}</h3>
            <p>{{ current!.d }}</p>
          </div>
        </div>

        <div class="works2__list">
          <div
            v-for="(it, i) in WORKS" :key="it.slot"
            class="works2__row" :class="{ on: i === active }"
            @mouseenter="active = i" @click="active = i"
          >
            <span class="rnum">{{ pad2(i + 1) }}</span>
            <span class="rttl">{{ it.t }}</span>
            <span class="rarrow">
              <svg class="arr" width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12 12 4M6 4h6v6" /></svg>
            </span>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>