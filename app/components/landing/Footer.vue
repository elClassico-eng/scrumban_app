<template>
  <footer id="footer" class="section footer">
    <div class="wrap">
      <div class="footer__top">
        <div class="footer__brand">
          <p>Scrumban-доска с аналитикой потока и прогнозом сроков. Дипломный проект в открытой бете.</p>
          <span class="nav__beta"><LandingStatusChip kind="dev" /></span>
        </div>
        <div class="footer__cols">
          <div class="footer__col">
            <h5>Продукт</h5>
            <a href="#what">Что работает</a>
            <a href="#roadmap">Roadmap</a>
            <a href="#pilots">Пилотам</a>
          </div>
          <div class="footer__col">
            <h5>Контакты</h5>
            <a href="mailto:daniilerkesov122@gmail.com">daniilerkesov122@gmail.com</a>
            <a href="https://t.me/paytina4" target="_blank" rel="noopener">Telegram · @paytina4</a>
          </div>
        </div>
      </div>
      <div class="footer__bottom">
        <span>© ScrumBan 2027 · дипломный проект ВолГУ</span>
        <NuxtLink to="/privacy" class="footer__legal">Политика обработки данных</NuxtLink>
      </div>
    </div>
  </footer>
</template>