<script setup lang="ts">
import '~/assets/css/landing.css'

definePageMeta({ layout: false })

const updated = '21 июня 2026'
const contactEmail = 'daniilerkesov122@gmail.com'

useHead({
  title: 'Политика обработки персональных данных — Такт',
  bodyAttrs: { class: 'landing-page' },
})
</script>

<template>
  <div class="landing">
    <header class="legal__bar">
      <div class="wrap legal__bar-in">
        <NuxtLink to="/" external class="legal__back">← На главную</NuxtLink>
        <NuxtLink to="/" external class="legal__wordmark"><b>Такт</b><i>*</i></NuxtLink>
      </div>
    </header>

    <main class="legal">
      <div class="wrap legal__wrap">
        <div class="legal__tag">Правовая информация</div>
        <h1>Политика обработки персональных данных</h1>
        <p class="legal__meta">Редакция от {{ updated }}</p>

        <p class="legal__lead">
          Эта политика описывает, какие персональные данные собирает форма раннего доступа
          на сайте Такт, зачем и на каком основании они обрабатываются, а также какие
          права есть у вас как у субъекта данных. Документ подготовлен в соответствии
          с Федеральным законом № 152-ФЗ «О персональных данных».
        </p>

        <h2><span class="num">01</span>Кто обрабатывает данные</h2>
        <p>
          Оператором является автор проекта Такт — дипломной разработки, выполняемой
          в Волгоградском государственном университете. Связаться можно по адресу
          <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>.
          Такт находится в стадии открытой беты; форма используется только для набора
          участников раннего доступа, а не для коммерческой деятельности.
        </p>

        <h2><span class="num">02</span>Какие данные мы собираем</h2>
        <p>Через форму раннего доступа обрабатываются только те данные, которые вы вводите сами:</p>
        <ul>
          <li>адрес электронной почты — обязательное поле;</li>
          <li>название команды или ваша роль — по желанию;</li>
          <li>выбранный интерес: «хочу попробовать», «обсудить сотрудничество» или «просто следить».</li>
        </ul>
        <p>
          Мы не запрашиваем паспортные данные, телефон, адрес или иные специальные категории
          персональных данных. Технические сведения (например, IP-адрес) для маркетинговых
          целей не сохраняются.
        </p>

        <h2><span class="num">03</span>Зачем мы их обрабатываем</h2>
        <ul>
          <li>отправить вам приглашение в рабочее пространство беты;</li>
          <li>связаться по поводу раннего доступа и обсудить, что вам важнее в продукте;</li>
          <li>иногда присылать важные обновления беты — без спама и рекламных рассылок.</li>
        </ul>

        <h2><span class="num">04</span>На каком основании</h2>
        <p>
          Правовое основание обработки — ваше согласие (п. 1 ч. 1 ст. 6 152-ФЗ). Вы даёте его
          осознанно, отмечая отдельный флажок в форме перед отправкой. Без отметки данные
          не отправляются и не сохраняются.
        </p>

        <h2><span class="num">05</span>Сколько храним</h2>
        <p>
          Данные хранятся до момента, пока актуален набор в бету, либо до отзыва вами согласия —
          в зависимости от того, что наступит раньше. После этого запись удаляется.
        </p>

        <h2><span class="num">06</span>Кому передаём</h2>
        <p>
          Мы не продаём и не передаём ваши данные третьим лицам в маркетинговых целях. Данные
          могут обрабатываться поставщиками инфраструктуры (хостинг, сервис отправки писем),
          которые привлекаются исключительно для работы сервиса и действуют по нашему поручению.
        </p>

        <h2><span class="num">07</span>Ваши права</h2>
        <ul>
          <li>получить информацию об обработке ваших данных;</li>
          <li>уточнить, исправить или удалить их;</li>
          <li>отозвать согласие в любой момент.</li>
        </ul>
        <p>
          Чтобы воспользоваться любым из прав, напишите на
          <a :href="`mailto:${contactEmail}`">{{ contactEmail }}</a>.
          Мы обработаем обращение и удалим данные по запросу в разумный срок.
        </p>

        <h2><span class="num">08</span>Как мы защищаем данные</h2>
        <p>
          Доступ к собранным заявкам имеет только автор проекта. Данные хранятся в базе данных
          с ограниченным доступом; мы принимаем разумные организационные и технические меры,
          чтобы исключить несанкционированный доступ к ним.
        </p>

        <h2><span class="num">09</span>Изменения политики</h2>
        <p>
          Актуальная редакция всегда опубликована на этой странице. Существенные изменения
          мы отметим обновлением даты редакции вверху документа.
        </p>

        <div class="legal__note">
          Такт — учебный дипломный проект. Документ описывает фактическую обработку данных
          формой раннего доступа и будет дополнен по мере развития продукта.
        </div>
      </div>
    </main>

    <LandingFooter />
  </div>
</template>

<style scoped>
.legal__bar {
  position: sticky; top: 0; z-index: 50;
  background: rgba(251, 250, 248, 0.82);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border-bottom: 1px solid var(--line);
}
.legal__bar-in {
  display: flex; align-items: center; justify-content: space-between;
  height: 64px;
}
.legal__back {
  font-size: 14px; color: var(--ink-2);
  transition: color 0.2s var(--ease);
}
.legal__back:hover { color: var(--ink); }
.legal__wordmark {
  font-family: var(--font-wordmark); font-size: 17px; font-weight: 600;
  color: var(--ink);
}
.legal__wordmark i { font-style: normal; color: var(--orange); }

.legal { padding: clamp(48px, 8vw, 96px) 0 clamp(64px, 9vw, 120px); }
.legal__wrap { max-width: 760px; }

.legal__tag {
  font-family: var(--font-mono); font-size: 12px;
  letter-spacing: 0.08em; text-transform: uppercase;
  color: var(--ink-3);
  margin-bottom: 16px;
}
.legal h1 {
  font-family: var(--font-display); font-weight: 500;
  font-size: clamp(32px, 4.5vw, 52px);
  line-height: 1.1; letter-spacing: -0.02em;
  margin: 0;
}
.legal__meta {
  margin-top: 12px;
  font-family: var(--font-mono); font-size: 13px;
  color: var(--ink-3);
}
.legal__lead {
  margin-top: 28px;
  font-size: 18px; line-height: 1.7;
  color: var(--ink-2);
}

.legal h2 {
  display: flex; align-items: baseline; gap: 14px;
  font-family: var(--font-display); font-weight: 500;
  font-size: clamp(22px, 2.6vw, 30px);
  line-height: 1.25; letter-spacing: -0.01em;
  margin: 52px 0 16px;
}
.legal h2 .num {
  flex: 0 0 auto;
  font-family: var(--font-mono); font-size: 14px; font-weight: 500;
  color: var(--orange);
  transform: translateY(-2px);
}

.legal p {
  font-size: 16px; line-height: 1.75;
  color: var(--ink-2);
  margin: 0 0 14px;
}
.legal ul {
  margin: 0 0 14px; padding: 0;
  list-style: none;
  display: flex; flex-direction: column; gap: 10px;
}
.legal li {
  position: relative;
  padding-left: 20px;
  font-size: 16px; line-height: 1.65;
  color: var(--ink-2);
}
.legal li::before {
  content: "";
  position: absolute; left: 2px; top: 10px;
  width: 6px; height: 6px; border-radius: 50%;
  background: var(--orange);
}
.legal a {
  color: var(--orange);
  text-decoration: underline; text-underline-offset: 2px;
}
.legal a:hover { color: var(--orange-press); }

.legal__note {
  margin-top: 48px;
  padding: 24px;
  border-radius: 20px;
  background: linear-gradient(160deg, var(--haze-2), var(--haze-3));
  font-size: 14.5px; line-height: 1.65;
  color: var(--ink-2);
}
</style>

