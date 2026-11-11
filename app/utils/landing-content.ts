export type NavLink = { label: string, href: string }

export const LANDING_NAV: NavLink[] = [
  { label: 'Возможности', href: '#features' },
  { label: 'Прогноз', href: '#forecast' },
  { label: 'Интеграции', href: '#integrations' },
  { label: 'Обновления', href: '#updates' },
]

export const LANDING_CHANNEL_LINKS: { vk?: string, telegram?: string } = {}

export const AUTHOR_EMAIL = 'daniilerkesov122@gmail.com'

export const OPERATOR_NAME = 'Черкесов Даниил Романович'

export const LEGAL_UPDATED = '9 ноября 2026'

// `video` is a path without extension: components serve .webm and an .mp4 fallback for Safari.
export type DemoScene = { id: string, title: string, poster: string, video?: string }

export const DEMO_SCENES: DemoScene[] = [
  { id: 'workspace', video: '/landing/demo/workspace', title: 'Создайте workspace за минуту', poster: '/landing/demo/workspace.jpg' },
  { id: 'board', video: '/landing/demo/board', title: 'Ведите задачи на доске', poster: '/landing/demo/board.jpg' },
  { id: 'sprint', video: '/landing/demo/sprint', title: 'Планируйте спринт', poster: '/landing/demo/sprint.jpg' },
  { id: 'flow', video: '/landing/demo/flow', title: 'Видите, где застревает работа', poster: '/landing/demo/flow.jpg' },
  { id: 'forecast', video: '/landing/demo/forecast', title: 'Узнайте, когда закончите', poster: '/landing/demo/forecast.jpg' },
]

export type Step = { title: string, text: string }

export const STEPS: Step[] = [
  { title: 'Ведите задачи на доске', text: 'Колонки, WIP-лимиты и спринты. Привычный Scrumban, который настраивается за вечер, а не за квартал.' },
  { title: 'Такт запоминает поток', text: 'Каждое перемещение карточки записывается. Из этого сами собираются время цикла (cycle time), пропускная способность и накопительная диаграмма – без ручных отчётов.' },
  { title: 'Спросите, когда закончите', text: 'Такт прогоняет тысячи сценариев по вашей истории и отвечает: «с вероятностью 85% – к 14 ноября».' },
]

export type Feature = { title: string, text: string, icon?: string, poster?: string, video?: string }

export const FEATURES_BIG: Feature[] = [
  { title: 'Доска и спринты', text: 'Ритм спринтов из Scrum и непрерывный поток из Kanban на одной доске. Цель спринта, WIP-лимиты, номера задач вида ПОТ-42.', poster: '/landing/demo/board.jpg', video: '/landing/demo/board' },
  { title: 'Прогноз сроков', text: 'Monte Carlo по реальной пропускной способности команды: P50, P85 и P95 вместо одной даты «на глаз».', poster: '/landing/demo/forecast.jpg', video: '/landing/demo/forecast' },
]

export const FEATURES_SMALL: Feature[] = [
  { title: 'Аналитика потока', text: 'Накопительная диаграмма, время цикла, эффективность потока – видно, где застревает работа.', icon: 'i-hugeicons-chart-line-data-01' },
  { title: 'Сетевое планирование', text: 'CPM и PERT: критический путь спринта и зависимости между задачами.', icon: 'i-hugeicons-hierarchy-square-02' },
  { title: 'Симулятор «что если»', text: 'Уберите задачу или сдвиньте срок – и посмотрите на прогноз до решения.', icon: 'i-hugeicons-test-tube-01' },
  { title: 'Ретро как встреча', text: 'Таймер, голосование и действия, которые не теряются после встречи.', icon: 'i-hugeicons-refresh' },
]

export type ComparisonRow = { topic: string, usual: string, takt: string }

export const COMPARISON: ComparisonRow[] = [
  { topic: 'Срок', usual: 'дата «на глаз» в плане', takt: 'вероятность по истории команды' },
  { topic: 'WIP-лимит', usual: 'число с потолка', takt: 'рекомендация по закону Литтла' },
  { topic: 'Риски', usual: 'всплывают на ретро', takt: 'видны в симуляторе до решения' },
  { topic: 'Отчёты', usual: 'собирают руками', takt: 'строятся из движения карточек' },
  { topic: 'Фокус', usual: 'всё для всех', takt: 'поток и сроки' },
]

export type FaqItem = { q: string, a: string }

export const FAQ: FaqItem[] = [
  { q: 'Это правда бесплатно?', a: 'Да. Пока идёт бета, все функции бесплатны и без ограничений.' },
  { q: 'Что значит «бета»?', a: 'Такт уже работает на реальных командах, но ещё дорабатывается: возможны неточности и шероховатости. Если что-то работает не так, напишите на странице отзывов – я читаю каждое сообщение и исправляю.' },
  { q: 'Чем Такт отличается от обычного трекера?', a: 'Обычный трекер хранит задачи. Такт по истории движения карточек считает, когда работа будет готова: показывает вероятность сроков, узкие места потока и рекомендации по WIP-лимитам.' },
  { q: 'Откуда прогноз знает сроки?', a: 'Из вашей же истории: сколько задач команда закрывает в день и как долго они идут по доске. Метод Monte Carlo прогоняет тысячи вариантов будущего на этих данных и показывает, с какой вероятностью работа успеет к дате. Все формулы описаны в документации.' },
  { q: 'Где хранятся данные?', a: 'На серверах в Москве. Данные каждого рабочего пространства изолированы на уровне базы, пароли хранятся только в виде хеша, сторонних трекеров на сайте нет.' },
  { q: 'Можно перенести задачи из Jira или Trello?', a: 'Импорт из Jira, Trello, YouGile и CSV вместе с историей статусов запланирован на релиз 0.6. Пока задачи заводятся вручную.' },
  { q: 'Кто делает Такт?', a: 'Я, Даниил, магистрант ВолГУ. Такт – мой дипломный проект, и я развиваю его вместе с первыми командами.' },
]

export function faqJsonLd(items: FaqItem[]): Record<string, unknown> {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    'mainEntity': items.map(i => ({
      '@type': 'Question',
      'name': i.q,
      'acceptedAnswer': { '@type': 'Answer', 'text': i.a },
    })),
  }
}

export type Plan = { stage?: string, title: string, text?: string }

export const PLANS: Plan[] = [
  { stage: '0.6 · для разработчиков', title: 'Git по номерам задач', text: 'ПОТ-42 в коммите двигает карточку' },
  { title: 'Импорт с историей статусов', text: 'прогноз работает с первого дня' },
  { title: 'Публичный API и MCP-сервер' },
  { stage: 'позже', title: 'Ссылка на прогноз для заказчика', text: 'и подсказки, как читать графики' },
]

export const INTEGRATIONS_SOON: string[] = [
  'GitFlic · GitLab · GitHub',
  'Импорт из Jira, Trello, YouGile, CSV',
  'Публичный API',
  'MCP-сервер',
]

export const DATA_STORED: Array<{ what: string, why: string }> = [
  { what: 'Email', why: 'для входа и уведомлений, которые вы включили сами' },
  { what: 'Имя', why: 'его видят коллеги в задачах и комментариях' },
  { what: 'Задачи, комментарии, файлы', why: 'только внутри вашего рабочего пространства' },
  { what: 'Хеш пароля', why: 'не сам пароль' },
]

export const DATA_NOT_STORED: string[] = [
  'Пароль в открытом виде',
  'Телефон, паспортные и платёжные данные',
  'Рекламные трекеры и счётчики посещений',
  'Ничего не продаётся и не передаётся третьим лицам',
]

export const SECURITY_MEASURES: Feature[] = [
  { title: 'Изоляция на уровне базы', text: 'Row-Level Security в PostgreSQL: каждый запрос ограничен вашим рабочим пространством самой базой, а не только кодом.', icon: 'i-hugeicons-database-locked' },
  { title: 'Серверы в Москве', text: 'Данные хранятся в России, по требованиям 152-ФЗ.', icon: 'i-hugeicons-location-01' },
  { title: 'Пароль – только хеш', text: 'scrypt с солью: по хешу пароль не прочитать, а подбор медленный и дорогой.', icon: 'i-hugeicons-square-lock-02' },
  { title: 'Защита от подбора', text: 'Не больше 5 попыток входа за 15 минут с одного адреса для одной почты.', icon: 'i-hugeicons-shield-01' },
  { title: 'HTTPS и защищённая сессия', text: 'Соединение шифруется, cookie сессии недоступна скриптам на странице.', icon: 'i-hugeicons-globe-02' },
  { title: 'Ключи интеграций зашифрованы', text: 'Токены «Пачки» и других сервисов хранятся шифром AES-GCM.', icon: 'i-hugeicons-key-01' },
]

export const PILOT_TERMS: string[] = [
  'Бесплатно – вся бета, все функции',
  'Связь напрямую со мной: ВКонтакте, Telegram или почта',
  'Ваши замечания попадают в ближайшие релизы',
]

export const FULL_BLEED: { title: string, text: string, image: string, cta?: { label: string, to: string } } = {
  title: 'Ритм важнее скорости',
  text: 'Команда, которая работает ровно, предсказуемее команды, которая работает быстро. Такт делает этот ритм видимым.',
  // Unsplash License (free, no attribution required): https://unsplash.com/photos/background-pattern-px-d44bbe7o
  image: '/landing/rhythm.webp',
}
