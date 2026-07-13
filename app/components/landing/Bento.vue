<template>
  <section id="why" class="section bento">
    <div class="wrap">
      <div class="bento__head reveal">
        <p class="eyebrow">Преимущества</p>
        <h2>Почему Такт?</h2>
      </div>

      <div class="bento__grid reveal">
        <article class="bcard bcard--stat">
          <div class="bcard__big mono">P50 · P85 · P95</div>
          <p>Прогноз с доверительным интервалом, а не «успеем / не успеем». Вероятность уложиться в срок считается по истории вашей команды.</p>
        </article>

        <article class="bcard bcard--shot">
          <img class="shot" src="/landing/board.webp" alt="Доска Такта: колонки с WIP-лимитами, классы обслуживания, возраст задач" loading="lazy">
          <h3>Kanban и спринты вместе</h3>
          <p>Спринты задают ритм, поток даёт предсказуемость. Две методологии работают вместе, а не вместо.</p>
        </article>

        <article class="bcard bcard--dark">
          <div class="bcard__big">0 чёрных ящиков</div>
          <p>Каждая цифра объясняется формулой: закон Литтла, перцентили cycle time, CFD. Всё проверяется.</p>
        </article>

        <article class="bcard bcard--haze">
          <div class="bcard__big">30+</div>
          <p>Команды, роли от владельца до наблюдателя, изоляция данных на уровне строк базы (RLS).</p>
        </article>

        <article class="bcard bcard--cfd">
          <div class="bcfd" aria-hidden="true">
            <i /><i /><i />
          </div>
          <h3>Аналитика из событий</h3>
          <p>CFD, cycle time и throughput считаются из переходов задач, а не из ручных оценок.</p>
        </article>

        <article class="bcard bcard--badge">
          <LandingSpinningBadge text="monte carlo · cpm · pert · little's law · " />
          <p>Real-time из коробки: доска обновляется у всей команды мгновенно.</p>
        </article>
      </div>
    </div>
  </section>
</template>
