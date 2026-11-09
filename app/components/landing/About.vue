<template>
  <section class="section">
    <div class="wrap">
      <LandingSectionHead :n="8" label="о проекте" />
      <div class="about">
        <article class="card card--dark about__title reveal">
          <h3>Дипломный проект, который работает по-настоящему</h3>
        </article>
        <article class="card reveal">
          <p class="about__lead">
            Меня зовут Даниил, я магистрант ВолГУ. Такт – мой дипломный проект: я проверяю, может ли математика потока сделать сроки в IT честнее.
          </p>
          <p class="muted about__p">
            Вся математика описана в открытой документации – каждую формулу можно проверить. Поэтому я не обещаю «AI-магию»: только статистика по вашей истории.
          </p>
          <div class="about__cta">
            <a class="btn btn--dark" href="/docs">Документация</a>
            <a class="btn btn--ghost" href="/docs/math">Как считается прогноз →</a>
          </div>
        </article>
      </div>
    </div>
  </section>
</template>

<style scoped>
.about { display: grid; grid-template-columns: 1fr 1.3fr; gap: 16px; }
.about__title { display: flex; align-items: flex-end; min-height: 240px; }
.about__title h3 { font-size: clamp(28px, 3vw, 38px); line-height: 1.1; }
.about__lead { font-size: 18px; line-height: 1.55; }
.about__p { margin-top: 12px; }
.about__cta { display: flex; flex-wrap: wrap; gap: 10px; margin-top: 22px; }

@media (max-width: 900px) {
  .about { grid-template-columns: 1fr; }
  .about__title { min-height: 0; }
}
</style>
