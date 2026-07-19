<script setup lang="ts">
type Fact = { icon: string, title: string, desc: string }

const FACTS: Fact[] = [
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v14c0 1.7 3.6 3 8 3s8-1.3 8-3V5"/><path d="M4 12c0 1.7 3.6 3 8 3s8-1.3 8-3"/></svg>',
    title: 'Изоляция на уровне строк базы',
    desc: 'PostgreSQL Row-Level Security с принудительными политиками: приложение физически не может прочитать данные чужого рабочего пространства, даже если в коде запроса ошибка.',
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
    title: 'Пароли не хранятся',
    desc: 'В базе лежит только криптографический хэш пароля. Вход защищён ограничением частоты попыток.',
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    title: 'Сессии в HTTP-only cookies',
    desc: 'Токен сессии недоступен скриптам на странице: даже вредоносный код в браузере не сможет его украсть.',
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6h16v12H4z"/><path d="m4 7 8 6 8-6"/></svg>',
    title: 'Подтверждение email',
    desc: 'Подтверждение адреса, сброс пароля и приглашения работают через одноразовые ссылки с истечением срока.',
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8"/></svg>',
    title: 'Роли проверяются на сервере',
    desc: 'Пять уровней доступа от наблюдателя до владельца. Каждое действие проверяется бэкендом, а не кнопками в интерфейсе.',
  },
  {
    icon: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2 4 6v6c0 5 3.4 8.4 8 10 4.6-1.6 8-5 8-10V6l-8-4z"/></svg>',
    title: 'Хостинг в РФ и TLS',
    desc: 'Серверы в Yandex Cloud, весь трафик шифруется: сертификаты выпускаются и продлеваются автоматически.',
  },
]
</script>

<template>
  <section id="security" class="section sec">
    <div class="cone cone--sec" aria-hidden="true">
      <i class="cone__l cone__l--1" /><i class="cone__l cone__l--2" /><i class="cone__l cone__l--3" />
    </div>
    <div class="wrap sec__inner">
      <div class="sec__head reveal">
        <p class="eyebrow">Безопасность</p>
        <h2>Ваши данные изолированы<br>на уровне базы</h2>
        <p class="sec__sub">
          В Такте хранятся задачи и их история, участники и роли, email и хэш пароля – и ничего лишнего.
          Платёжных данных нет: продукт бесплатен на время открытой беты.
        </p>
      </div>
      <div class="sec__grid reveal">
        <article v-for="f in FACTS" :key="f.title" class="scard">
          <span class="scard__ic" v-html="f.icon" />
          <h3>{{ f.title }}</h3>
          <p>{{ f.desc }}</p>
        </article>
      </div>
    </div>
  </section>
</template>
