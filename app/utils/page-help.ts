export type DocLink = { label: string, path: string }
export type PageHelp = { title: string, tips: string[], docs: DocLink[] }

const DOC = {
  guide: { label: 'Руководство пользователя', path: '/docs/guide' },
  navigation: { label: 'Навигация и горячие клавиши', path: '/docs/guide/navigation' },
  inbox: { label: 'Входящие и мои задачи', path: '/docs/guide/inbox' },
  tasks: { label: 'Задачи: номера, наблюдение, совместная правка', path: '/docs/guide/tasks' },
  list: { label: 'Список и массовые действия', path: '/docs/guide/list' },
  scrumban: { label: 'Scrumban: ритм плюс поток', path: '/docs/methodology/scrumban' },
  kanban: { label: 'Kanban: поток и WIP-лимиты', path: '/docs/methodology/kanban' },
  scrum: { label: 'Scrum: спринты и ритм', path: '/docs/methodology/scrum' },
  monteCarlo: { label: 'Монте-Карло: симуляция сроков', path: '/docs/math/monte-carlo' },
  little: { label: 'Закон Литтла и WIP-лимиты', path: '/docs/math/littles-law' },
  sle: { label: 'SLE: сервисное ожидание', path: '/docs/math/sle' },
  flowEfficiency: { label: 'Эффективность потока', path: '/docs/math/flow-efficiency' },
  calibration: { label: 'Калибровка прогнозов', path: '/docs/math/calibration' },
  cpm: { label: 'CPM: критический путь', path: '/docs/math/cpm' },
  pert: { label: 'PERT: три оценки и σ', path: '/docs/math/pert' },
  simulator: { label: 'Симулятор решений', path: '/docs/math/simulator' },
  roles: { label: 'Роли и права доступа', path: '/docs/project/roles' },
} satisfies Record<string, DocLink>

const HELP: Record<string, PageHelp> = {
  'workspaces-id': {
    title: 'Обзор воркспейса',
    tips: [
      'Блок «Активный спринт» показывает шанс успеть в срок по симуляции Монте-Карло.',
      '«Ваши задачи» собирают просроченное и ближайшие сроки со всех досок.',
      'Карта активности: наведите на день, чтобы увидеть сводку, нажмите, чтобы закрепить.',
    ],
    docs: [DOC.monteCarlo, DOC.scrumban],
  },
  'workspaces-id-inbox': {
    title: 'Входящие',
    tips: [
      '«Основное» – то, что обращено к вам лично; «Поток» – сигналы о здоровье досок.',
      '«Разобрать» убирает строку из очереди, «прочитано» только отмечает, что вы видели.',
      '«Отложить» прячет строку до выбранного времени, потом она вернётся непрочитанной.',
      'События по одной задаче собраны в одну строку, число справа – сколько их.',
    ],
    docs: [DOC.inbox],
  },
  'workspaces-id-my-tasks': {
    title: 'Мои задачи',
    tips: [
      'Здесь все задачи, где вы исполнитель, со всех досок воркспейса.',
      'Быстрые фильтры сверху показывают, сколько просрочено, на сегодня и с блокерами.',
      'Группировку можно сменить: по сроку, по статусу или по доске.',
      'Задача открывается поверх страницы, крестик возвращает сюда же.',
    ],
    docs: [DOC.inbox],
  },
  'workspaces-id-boards-boardId': {
    title: 'Доска',
    tips: [
      'Перетаскивайте карточки между колонками, чтобы двигать задачи по потоку.',
      'Цифры у колонки – сколько задач в ней и какой WIP-лимит.',
      'Фильтры «Срочные» и «С блокерами» помогают быстро найти, что мешает потоку.',
    ],
    docs: [DOC.list, DOC.tasks, DOC.kanban, DOC.little, DOC.sle],
  },
  'workspaces-id-boards-boardId-analytics': {
    title: 'Аналитика доски',
    tips: [
      'Все графики строятся по истории перемещений задач, а не по ручным отметкам.',
      'Прогноз сроков считается симуляцией по фактической пропускной способности.',
    ],
    docs: [DOC.monteCarlo, DOC.little, DOC.sle, DOC.flowEfficiency],
  },
  'workspaces-id-boards-boardId-sprints': {
    title: 'Спринты',
    tips: [
      'Шанс закрыть спринт в срок пересчитывается по мере движения задач.',
      'Если шанс падает, пересмотрите состав спринта, а не сроки.',
    ],
    docs: [DOC.scrum, DOC.monteCarlo],
  },
  'workspaces-id-boards-boardId-timeline': {
    title: 'Таймлайн',
    tips: [
      'Таймлайн строится по зависимостям задач, критический путь выделен цветом.',
    ],
    docs: [DOC.cpm, DOC.pert],
  },
  'workspaces-id-boards-boardId-forecast-journal': {
    title: 'Журнал прогнозов',
    tips: ['Журнал сверяет прошлые прогнозы с фактом, чтобы было видно, насколько им можно верить.'],
    docs: [DOC.calibration],
  },
  'workspaces-id-boards-boardId-simulator-sprintId': {
    title: 'Симулятор спринта',
    tips: ['Меняйте состав и параметры спринта и сравнивайте сценарии до того, как принять решение.'],
    docs: [DOC.simulator, DOC.monteCarlo],
  },
  'workspaces-id-simulator': {
    title: 'Симулятор',
    tips: ['Меняйте состав и параметры и сравнивайте сценарии до того, как принять решение.'],
    docs: [DOC.simulator],
  },
  'workspaces-id-members': {
    title: 'Участники',
    tips: ['Роль определяет, что человек может делать: от просмотра до управления воркспейсом.'],
    docs: [DOC.roles],
  },
}

const FALLBACK: PageHelp = {
  title: 'Такт',
  tips: ['Нажмите ⌘K, чтобы найти задачу, страницу или действие.'],
  docs: [DOC.navigation, DOC.guide, DOC.scrumban],
}

export function pageHelp(routeName: string | null | undefined): PageHelp {
  return (routeName && HELP[routeName]) || FALLBACK
}
