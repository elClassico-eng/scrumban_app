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

export type DemoScene = { id: string, title: string, poster: string, video?: string }

export const DEMO_SCENES: DemoScene[] = [
  { id: 'workspace', title: 'Создайте workspace за минуту', poster: '/landing/board.webp' },
  { id: 'board', title: 'Ведите задачи на доске', poster: '/landing/board.webp' },
  { id: 'sprint', title: 'Планируйте спринт', poster: '/landing/board.webp' },
  { id: 'flow', title: 'Видите, где застревает работа', poster: '/landing/analytics.webp' },
  { id: 'forecast', title: 'Узнайте, когда закончите', poster: '/landing/forecast.webp' },
]

export type Step = { title: string, text: string }

export const STEPS: Step[] = [
  { title: 'Ведите задачи на доске', text: 'Колонки, WIP-лимиты и спринты. Привычный Scrumban, который настраивается за вечер, а не за квартал.' },
  { title: 'Такт запоминает поток', text: 'Каждое перемещение карточки записывается. Из этого сами собираются время цикла (cycle time), пропускная способность и накопительная диаграмма – без ручных отчётов.' },
  { title: 'Спросите, когда закончите', text: 'Такт прогоняет тысячи сценариев по вашей истории и отвечает: «с вероятностью 85% – к 14 ноября».' },
]

export type Feature = { title: string, text: string, icon?: string, poster?: string, video?: string }

export const FEATURES_BIG: Feature[] = [
  { title: 'Доска и спринты', text: 'Ритм спринтов из Scrum и непрерывный поток из Kanban на одной доске. Цель спринта, WIP-лимиты, номера задач вида ПОТ-42.', poster: '/landing/board.webp' },
  { title: 'Прогноз сроков', text: 'Monte Carlo по реальной пропускной способности команды: P50, P85 и P95 вместо одной даты «на глаз».', poster: '/landing/forecast.webp' },
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
