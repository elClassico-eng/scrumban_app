export type RoadmapStatus = 'done' | 'now' | 'next' | 'later'

export type RoadmapArea = 'board' | 'math' | 'automation' | 'ux' | 'integrations' | 'platform' | 'research'

export type RoadmapItem = {
  id: string
  title: string
  text: string
  status: RoadmapStatus
  area: RoadmapArea
  release?: string
  docs?: string
  why?: string
}

export const ROADMAP_STATUS: Record<RoadmapStatus, { label: string; hint: string }> = {
  done: { label: 'Реализовано', hint: 'Работает в коде, это можно потрогать' },
  now: { label: 'Сейчас', hint: 'В работе или следующее в очереди' },
  next: { label: 'Дальше', hint: 'Решено делать, порядок после текущего' },
  later: { label: 'Потом', hint: 'Сознательно отложено: сначала данные пилотов или обратная связь' },
}

export const ROADMAP_AREA: Record<RoadmapArea, string> = {
  board: 'Доска и спринты',
  math: 'Математика',
  automation: 'Автоматизации',
  ux: 'Интерфейс',
  integrations: 'Интеграции',
  platform: 'Платформа',
  research: 'Исследование',
}

export const ROADMAP: RoadmapItem[] = [
  {
    id: 'board',
    title: 'Доска Scrumban',
    text: 'Колонки потока, WIP-лимиты с подсветкой, классы обслуживания, старение карточек, drag-n-drop, список и календарь.',
    status: 'done',
    area: 'board',
    docs: '/docs/methodology/scrumban',
  },
  {
    id: 'sprints',
    title: 'Жизненный цикл спринта',
    text: 'Планирование через мастер с прогнозом, старт и закрытие с решениями по незакрытым задачам, burndown, неизменяемый отчёт, ретроспектива с задачами, дайджест для daily.',
    status: 'done',
    area: 'board',
  },
  {
    id: 'deps',
    title: 'Зависимости и подзадачи',
    text: 'Граф блокировок между задачами, подзадачи и эпики, чек-листы, комментарии с упоминаниями, учёт времени.',
    status: 'done',
    area: 'board',
  },
  {
    id: 'network',
    title: 'Сетевой прогноз',
    text: 'CPM (критический путь и резервы) + PERT с оценками из истории команды + Монте-Карло по сети зависимостей.',
    status: 'done',
    area: 'math',
    docs: '/docs/math/cpm',
  },
  {
    id: 'simulator',
    title: 'Симулятор решений',
    text: 'Проверка решения до его принятия: исключить задачу, переоценить срок, разорвать блокировку, сдвинуть дедлайн, сравнить прогнозы и применить.',
    status: 'done',
    area: 'math',
    docs: '/docs/math/simulator',
  },
  {
    id: 'flow-analytics',
    title: 'Аналитика потока',
    text: 'CFD, throughput, cycle time, Монте-Карло по throughput, рекомендации WIP по закону Литтла, SLE и старение.',
    status: 'done',
    area: 'math',
    docs: '/docs/math',
  },
  {
    id: 'flow-efficiency',
    title: 'Эффективность потока',
    text: 'Доля времени работы против очередей и блокеров, по колонкам. Переключатель «Очередь» у колонки.',
    status: 'done',
    area: 'math',
    release: '0.2',
    docs: '/docs/math/flow-efficiency',
  },
  {
    id: 'calibration',
    title: 'Честная калибровка прогнозов',
    text: 'Факт по дню закрытия последней задачи, перенос засчитывается как промах, границы применимости, страница «Журнал прогнозов» и экспорт журнала и калибровки в CSV/JSON.',
    status: 'done',
    area: 'math',
    release: '0.2',
    docs: '/docs/math/calibration',
  },
  {
    id: 'automations',
    title: 'Автоматизации от математики',
    text: 'Правила «если старение / блокер / прогноз спринта / WIP / пополнение → уведомить, комментарий в задаче, повестка daily». Эпизоды вместо повторов, рекомендуемый набор для старта.',
    status: 'done',
    area: 'automation',
    release: '0.2',
    docs: '/docs/guide',
  },
  {
    id: 'notifications',
    title: 'Понятные уведомления',
    text: 'Каждое уведомление: что случилось, почему с цифрами, что сделать. Переходы к задаче, спринту или доске из центра управления.',
    status: 'done',
    area: 'ux',
    release: '0.2',
  },
  {
    id: 'control-center',
    title: 'Центр управления',
    text: 'Остров с вкладками Обзор / Поток / Поиск / Уведомления, плитки с живыми цифрами по доске, переключатель доски, настройка раскладки, ⌘K.',
    status: 'done',
    area: 'ux',
    release: '0.2',
    docs: '/docs/guide',
  },
  {
    id: 'auth-rbac',
    title: 'Аккаунты и роли',
    text: 'Пять ролей с наследованием, RLS на уровне базы, приглашения по ссылке, подтверждение почты, сброс пароля, список устройств, тёмная тема.',
    status: 'done',
    area: 'platform',
    docs: '/docs/project/roles',
  },
  {
    id: 'release',
    title: 'Выпуск 0.2 в прод',
    text: 'Слияние релизной ветки, тег, деплой на Yandex Cloud после возобновления хостинга.',
    status: 'now',
    area: 'platform',
  },
  {
    id: 'pilots-foundation',
    title: 'Фундамент для пилотных команд',
    text: 'Бэкапы прода по расписанию, архивация задач вместо удаления (удаление стирает историю событий), тесты и линт в CI.',
    status: 'now',
    area: 'platform',
    why: 'Без этого нельзя звать внешние команды: их данные и есть доказательная база.',
  },
  {
    id: 'pilots',
    title: 'Пилотные команды',
    text: 'Две-три команды по протоколу апробации: оценки и зависимости, старт и закрытие кнопками, от 6–8 спринтов на команду.',
    status: 'now',
    area: 'research',
    docs: '/docs/project/validation',
    why: 'Гипотезы H1 и H2 проверяются только на чужих данных.',
  },
  {
    id: 'telegram',
    title: 'Уведомления в Telegram',
    text: 'Привязка аккаунта и доставка тех же уведомлений (включая срабатывания автоматизаций) ботом. Далее Max.',
    status: 'next',
    area: 'integrations',
  },
  {
    id: 'ics',
    title: 'Подписка на календарь',
    text: 'Одна ICS-ссылка с дедлайнами и спринтами, работает в Google, Яндекс и Apple Календаре без OAuth.',
    status: 'next',
    area: 'integrations',
  },
  {
    id: 'backtest',
    title: 'Сравнение трёх методов прогноза',
    text: 'Наивный Монте-Карло, PERT и сетевой Монте-Карло на одном экспорте журнала: какой метод калиброван лучше.',
    status: 'next',
    area: 'research',
    docs: '/docs/project/validation',
    why: 'Имеет смысл от пяти засчитанных спринтов, данные уже копятся.',
  },
  {
    id: 'attachments',
    title: 'Вложения к задачам',
    text: 'Файлы через объектное хранилище (Yandex Object Storage или MinIO on-prem).',
    status: 'next',
    area: 'board',
  },
  {
    id: 'tiles-grid',
    title: 'Размеры плиток в центре управления',
    text: 'Плитки 1×1 / 2×1 / 2×2 и плотная сетка; хранение раскладки уже это допускает.',
    status: 'later',
    area: 'ux',
    why: 'Сначала обратная связь по первой версии.',
  },
  {
    id: 'gitflic',
    title: 'Интеграция с git (GitFlic, GitHub)',
    text: 'Задачи двигаются по доске по коммитам и запросам на слияние, cycle time становится честнее.',
    status: 'later',
    area: 'integrations',
    why: 'Вебхуки и токены, почти нулевой фундамент; стоит делать после пилотов.',
  },
  {
    id: 'queue',
    title: 'Очередь фоновых задач',
    text: 'pg-boss на Postgres для задач с очередной семантикой: повторные попытки доставки, email-дайджесты.',
    status: 'later',
    area: 'platform',
    why: 'Пока хватает планировщика Nitro: две периодические задачи.',
  },
  {
    id: 'automations-deep',
    title: 'Автоматизации глубже',
    text: 'Повторные напоминания по открытому эпизоду, действие «поднять в expedite», условия с параметрами колонок.',
    status: 'later',
    area: 'automation',
    why: 'Сначала посмотреть, какие правила реально включают команды.',
  },
  {
    id: 'historical-backtest',
    title: 'Проверка на исторических данных',
    text: 'Импорт открытых датасетов issue-трекеров в журнал событий и прогноз «задним числом» для сотен пар прогноз-факт.',
    status: 'later',
    area: 'research',
    docs: '/docs/project/validation',
    why: 'Согласовать с научным руководителем формат и источники.',
  },
]
