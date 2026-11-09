import { Hash } from '@adonisjs/hash'
import { Scrypt } from '@adonisjs/hash/drivers/scrypt'
import { eq, inArray, like, or } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import {
  boardColumns,
  boards,
  sprintTasks,
  sprints,
  taskAssignees,
  taskDependencies,
  taskEvents,
  tasks,
  users,
  workspaceMembers,
  workspaces,
} from '../server/db/schema'

// Local demo data for screenshots and the landing videos. Never run against prod:
// it deletes and recreates the demo workspace and every *@demo.seed user.
const OWNER_EMAIL = (process.env.SEED_OWNER_EMAIL ?? 'demo@takt.local').trim().toLowerCase()
const OWNER_PASSWORD = process.env.SEED_OWNER_PASSWORD ?? 'takt-demo-local-2026'
const WORKSPACE_SLUG = 'dostavka'
const LEGACY_SLUGS = ['demo-flow']

const DAY = 86_400_000
const HOUR = 3_600_000
const NOW = Date.now()
const HISTORY_WEEKS = 12

type Stage = 'backlog' | 'ready' | 'progress' | 'review' | 'testing' | 'done'
const STAGES: Stage[] = ['backlog', 'ready', 'progress', 'review', 'testing', 'done']

const COLUMNS: { stage: Stage, name: string, role: 'backlog' | 'in_progress' | 'review' | 'done', wip: number | null, queue?: boolean }[] = [
  { stage: 'backlog', name: 'Бэклог', role: 'backlog', wip: null },
  { stage: 'ready', name: 'Готово к работе', role: 'backlog', wip: null, queue: true },
  { stage: 'progress', name: 'В работе', role: 'in_progress', wip: 5 },
  { stage: 'review', name: 'Ревью', role: 'review', wip: 3, queue: true },
  { stage: 'testing', name: 'Тестирование', role: 'review', wip: 3 },
  { stage: 'done', name: 'Готово', role: 'done', wip: null },
]

const MEMBERS = [
  { email: 'anna@demo.seed', firstName: 'Анна', lastName: 'Соколова', jobTitle: 'Frontend-разработчик' },
  { email: 'igor@demo.seed', firstName: 'Игорь', lastName: 'Лебедев', jobTitle: 'Backend-разработчик' },
  { email: 'maria@demo.seed', firstName: 'Мария', lastName: 'Орлова', jobTitle: 'QA-инженер' },
  { email: 'dmitry@demo.seed', firstName: 'Дмитрий', lastName: 'Ковалёв', jobTitle: 'Мобильный разработчик' },
  { email: 'elena@demo.seed', firstName: 'Елена', lastName: 'Морозова', jobTitle: 'Дизайнер' },
  { email: 'pavel@demo.seed', firstName: 'Павел', lastName: 'Никитин', jobTitle: 'DevOps-инженер' },
]

const CLOSED_TITLES = [
  'Каталог: фильтр по времени доставки', 'Каталог: карточка ресторана с рейтингом', 'Каталог: ленивая загрузка фото блюд',
  'Каталог: пустое состояние поиска', 'Каталог: сортировка по расстоянию', 'Каталог: бейдж «Новинка»', 'Каталог: кэш меню на 5 минут',
  'Корзина: изменение количества без перезагрузки', 'Корзина: промокоды', 'Корзина: минимальная сумма заказа',
  'Корзина: предупреждение о закрытии ресторана', 'Корзина: перенос в новую сессию', 'Корзина: подсказка о бесплатной доставке', 'Корзина: удаление недоступных позиций',
  'Оплата: СБП на экране заказа', 'Оплата: сохранение карты', 'Оплата: повтор при таймауте эквайринга',
  'Оплата: чек на почту', 'Оплата: возврат при отмене', 'Оплата: 3-D Secure в webview', 'Оплата: логирование отказов банка',
  'Курьер: трекинг на карте', 'Курьер: смена статуса одним свайпом', 'Курьер: офлайн-режим заказов',
  'Курьер: маршрут с несколькими точками', 'Курьер: фото при вручении', 'Курьер: смены и перерывы', 'Курьер: push о новом заказе',
  'Профиль: адреса с подъездом и этажом', 'Профиль: история заказов', 'Профиль: удаление аккаунта',
  'Профиль: аллергены в настройках', 'Профиль: вход по номеру телефона', 'Профиль: тёмная тема', 'Профиль: повтор прошлого заказа',
  'Админка: управление стоп-листом', 'Админка: отчёт по выручке за день', 'Админка: роли менеджеров',
  'Админка: массовое редактирование цен', 'Админка: журнал изменений меню', 'Админка: импорт меню из Excel', 'Админка: зоны доставки на карте',
  'Уведомления: заказ принят', 'Уведомления: курьер рядом', 'Уведомления: отзыв после доставки',
  'Уведомления: тихие часы', 'Уведомления: SMS-резерв при отказе push', 'Уведомления: шаблоны на двух языках', 'Уведомления: группировка в Android',
  'Поиск: опечатки в названиях блюд', 'Поиск: подсказки по мере ввода', 'Поиск: история запросов',
  'Поиск: поиск по кухне', 'Поиск: индекс в Postgres', 'Поиск: аналитика пустых выдач', 'Поиск: синонимы «шаурма/шаверма»',
  'Партнёры: API статусов заказа', 'Партнёры: вебхуки о готовности', 'Партнёры: ключи доступа в кабинете',
  'Партнёры: лимиты запросов', 'Партнёры: песочница для интеграции', 'Партнёры: документация OpenAPI', 'Партнёры: ретраи вебхуков',
  'Инфраструктура: алерты по 5xx', 'Инфраструктура: бэкап базы каждую ночь', 'Инфраструктура: canary-деплой',
  'Инфраструктура: дашборд латентности', 'Инфраструктура: ротация логов', 'Инфраструктура: обновление Node до 22', 'Инфраструктура: rate-limit на API',
  'Каталог: скелетоны при загрузке', 'Каталог: счётчик калорий', 'Каталог: фото в WebP', 'Каталог: время приготовления на карточке', 'Каталог: избранные рестораны',
  'Корзина: комментарий для кухни', 'Корзина: столовые приборы по запросу', 'Корзина: выбор времени доставки', 'Корзина: пересчёт при смене адреса',
  'Оплата: Apple Pay и Google Pay', 'Оплата: разделение счёта', 'Оплата: бонусные баллы', 'Оплата: квитанция для юрлиц', 'Оплата: защита от двойного списания',
  'Курьер: навигация в один тап', 'Курьер: экономия батареи в фоне', 'Курьер: отметка «клиент не отвечает»', 'Курьер: статистика за смену', 'Курьер: экран сдачи наличных',
  'Профиль: экспорт данных', 'Профиль: смена номера телефона', 'Профиль: приглашение друга', 'Профиль: язык интерфейса',
  'Админка: заказы в реальном времени', 'Админка: блокировка курьера', 'Админка: шаблоны акций', 'Админка: поиск по заказам', 'Админка: выгрузка в CSV',
  'Уведомления: задержка заказа', 'Уведомления: акции по геолокации', 'Уведомления: управление подписками', 'Уведомления: deeplink в заказ',
  'Поиск: рекомендации «с этим берут»', 'Поиск: фильтр по цене', 'Поиск: популярное рядом', 'Поиск: исправление раскладки',
  'Партнёры: статус «готовится»', 'Партнёры: тестовые заказы', 'Партнёры: SLA-отчёт', 'Партнёры: подпись вебхуков',
  'Инфраструктура: трейсинг запросов', 'Инфраструктура: автоскейлинг воркеров', 'Инфраструктура: чистка старых логов', 'Инфраструктура: секреты в vault', 'Инфраструктура: нагрузочный тест оплаты',
]

const OPEN_TASKS: { title: string, stage: Stage, points: number, estimateDays: number, inSprint: boolean, serviceClass?: 'expedite' | 'fixed_date', dueInDays?: number }[] = [
  { title: 'Оплата: рассрочка через банк-партнёр', stage: 'progress', points: 8, estimateDays: 4.5, inSprint: true },
  { title: 'Курьер: оценка времени прибытия по пробкам', stage: 'progress', points: 5, estimateDays: 3, inSprint: true },
  { title: 'Корзина: совместный заказ по ссылке', stage: 'progress', points: 8, estimateDays: 5, inSprint: true },
  { title: 'Уведомления: статус заказа в Live Activity', stage: 'progress', points: 3, estimateDays: 2, inSprint: false },
  { title: 'Падение оплаты СБП на Android 14', stage: 'progress', points: 2, estimateDays: 1, inSprint: true, serviceClass: 'expedite' },
  { title: 'Каталог: персональные подборки', stage: 'review', points: 5, estimateDays: 3, inSprint: true },
  { title: 'Админка: акции по расписанию', stage: 'review', points: 3, estimateDays: 2, inSprint: true },
  { title: 'Профиль: семейный аккаунт', stage: 'testing', points: 5, estimateDays: 3, inSprint: true },
  { title: 'Партнёры: выгрузка заказов для 1С', stage: 'testing', points: 3, estimateDays: 2, inSprint: true, serviceClass: 'fixed_date', dueInDays: 6 },
  { title: 'Поиск: голосовой ввод', stage: 'ready', points: 3, estimateDays: 2, inSprint: true },
  { title: 'Курьер: чат с клиентом', stage: 'ready', points: 5, estimateDays: 3, inSprint: true },
  { title: 'Отчёты: время доставки по районам', stage: 'ready', points: 5, estimateDays: 3, inSprint: false },
  { title: 'Каталог: блюда дня', stage: 'backlog', points: 2, estimateDays: 1, inSprint: false },
  { title: 'Оплата: чаевые курьеру', stage: 'backlog', points: 3, estimateDays: 2, inSprint: false },
  { title: 'Профиль: подписка на бесплатную доставку', stage: 'backlog', points: 8, estimateDays: 5, inSprint: false },
  { title: 'Админка: прогноз загрузки кухни', stage: 'backlog', points: 8, estimateDays: 5, inSprint: false },
  { title: 'Уведомления: дайджест акций раз в неделю', stage: 'backlog', points: 2, estimateDays: 1, inSprint: false },
  { title: 'Партнёры: интеграция с POS-системами', stage: 'backlog', points: 13, estimateDays: 8, inSprint: false },
  { title: 'Инфраструктура: второй регион', stage: 'backlog', points: 13, estimateDays: 8, inSprint: false },
  { title: 'Поиск: фильтр «без глютена»', stage: 'backlog', points: 2, estimateDays: 1, inSprint: false },
  { title: 'Курьер: рейтинг и бонусы', stage: 'backlog', points: 5, estimateDays: 3, inSprint: false },
  { title: 'Корзина: напоминание о брошенном заказе', stage: 'backlog', points: 3, estimateDays: 2, inSprint: false },
]

const DEPENDENCIES: [string, string][] = [
  ['Поиск: голосовой ввод', 'Каталог: персональные подборки'],
  ['Оплата: рассрочка через банк-партнёр', 'Партнёры: выгрузка заказов для 1С'],
  ['Курьер: оценка времени прибытия по пробкам', 'Курьер: чат с клиентом'],
]

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a = (a + 0x6D2B79F5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20261109)
const pick = <T>(arr: T[]): T => arr[Math.floor(rnd() * arr.length)]!
const between = (min: number, max: number) => min + rnd() * (max - min)

// Working hours only, so cycle-time charts don't show tasks moving at 3am.
function workHour(ts: number): number {
  const d = new Date(ts)
  const h = d.getUTCHours()
  if (h < 6) d.setUTCHours(6 + Math.floor(rnd() * 3))
  if (h > 15) d.setUTCHours(13 + Math.floor(rnd() * 3))
  return d.getTime()
}

type PlannedTask = {
  id: string
  title: string
  stage: Stage
  createdAt: number
  stageTimes: number[]
  closedAt: number | null
  assigneeId: string
  points: number
  estimateDays: number | null
  serviceClass: 'standard' | 'expedite' | 'fixed_date'
  dueDate: number | null
  expeditedAt: number | null
}

async function main() {
  const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL_ADMIN / DATABASE_URL not set — check .env')
  if (/prod/i.test(url)) throw new Error('Refusing to seed a database whose URL mentions "prod"')

  const client = postgres(url, { max: 4 })
  const db = drizzle(client)

  try {
    await db.delete(workspaces).where(inArray(workspaces.slug, [WORKSPACE_SLUG, ...LEGACY_SLUGS]))
    await db.delete(users).where(or(like(users.email, '%@demo.seed'), like(users.email, '%@new.demo.seed')))

    const passwordHash = await new Hash(new Scrypt({})).make(OWNER_PASSWORD)
    let [owner] = await db.select({ id: users.id }).from(users).where(eq(users.email, OWNER_EMAIL))
    if (owner) {
      await db.update(users).set({ passwordHash, firstName: 'Даниил', lastName: 'Черкесов', jobTitle: 'Тимлид', personalDataConsentAt: new Date(), emailVerifiedAt: new Date() }).where(eq(users.id, owner.id))
    }
    else {
      ;[owner] = await db.insert(users).values({
        email: OWNER_EMAIL,
        passwordHash,
        firstName: 'Даниил',
        lastName: 'Черкесов',
        jobTitle: 'Тимлид',
        personalDataConsentAt: new Date(),
        emailVerifiedAt: new Date(),
      }).returning({ id: users.id })
    }
    const ownerId = owner!.id

    const memberRows = await db.insert(users).values(MEMBERS.map(m => ({
      ...m,
      passwordHash: 'demo-seed-not-a-real-hash',
      personalDataConsentAt: new Date(),
    }))).returning({ id: users.id })
    const team = [ownerId, ...memberRows.map(r => r.id)]

    const [ws] = await db.insert(workspaces).values({
      name: 'Платформа доставки',
      slug: WORKSPACE_SLUG,
      description: 'Продуктовая команда сервиса доставки еды: клиентское и курьерское приложения, админка, API партнёров.',
      industry: 'Доставка',
    }).returning({ id: workspaces.id })
    const workspaceId = ws!.id

    await db.insert(workspaceMembers).values([
      { workspaceId, userId: ownerId, role: 'owner' as const },
      ...memberRows.map((r, i) => ({ workspaceId, userId: r.id, role: (i === 0 ? 'admin' : 'member') as 'admin' | 'member' })),
    ])

    const [board] = await db.insert(boards).values({
      workspaceId,
      name: 'Продукт',
      slug: 'produkt',
      key: 'ДОС',
      color: '#e85002',
      sleDays: 6,
      sleProbability: '0.85',
    }).returning({ id: boards.id })
    const boardId = board!.id

    const cols = await db.insert(boardColumns).values(COLUMNS.map((c, i) => ({
      workspaceId,
      boardId,
      name: c.name,
      position: i,
      wipLimit: c.wip,
      columnRole: c.role,
      isQueue: c.queue ?? false,
    }))).returning({ id: boardColumns.id })
    const colId = Object.fromEntries(COLUMNS.map((c, i) => [c.stage, cols[i]!.id])) as Record<Stage, string>
    const roleOf = Object.fromEntries(COLUMNS.map(c => [c.stage, c.role])) as Record<Stage, string>

    const planned: PlannedTask[] = []
    const historyStart = NOW - HISTORY_WEEKS * 7 * DAY

    // Closed work spread over the history window, a little denser recently: the team got faster.
    CLOSED_TITLES.forEach((title, i) => {
      const progress = (i + rnd() * 0.8) / CLOSED_TITLES.length
      const closedAt = workHour(historyStart + Math.pow(progress, 0.85) * (NOW - historyStart - 2 * DAY))
      const cycleDays = pick([1.5, 2, 2.5, 3, 3, 3.5, 4, 4, 5, 5, 6, 7, 9, 12])
      const startedAt = workHour(closedAt - cycleDays * DAY)
      const createdAt = workHour(startedAt - between(0.3, 2) * DAY)
      const span = closedAt - startedAt
      const serviceClass = i % 17 === 5 ? 'expedite' : i % 23 === 9 ? 'fixed_date' : 'standard'
      planned.push({
        id: crypto.randomUUID(),
        title,
        stage: 'done',
        createdAt,
        stageTimes: [
          workHour(createdAt + between(0.2, 0.8) * (startedAt - createdAt)),
          startedAt,
          workHour(startedAt + span * between(0.45, 0.65)),
          workHour(startedAt + span * between(0.7, 0.85)),
          closedAt,
        ],
        closedAt,
        assigneeId: team[i % team.length]!,
        points: pick([1, 2, 3, 3, 5, 5, 8]),
        estimateDays: null,
        serviceClass,
        dueDate: serviceClass === 'fixed_date' ? closedAt + DAY : null,
        expeditedAt: serviceClass === 'expedite' ? createdAt + 2 * HOUR : null,
      })
    })

    OPEN_TASKS.forEach((t, i) => {
      const stageIdx = STAGES.indexOf(t.stage)
      const startedAt = workHour(NOW - between(0.4, 2.5) * DAY)
      const createdAt = workHour(startedAt - between(0.5, 3) * DAY)
      const stageTimes: number[] = []
      for (let s = 1; s <= stageIdx; s++) {
        const ts = s === 2 ? startedAt : workHour(s < 2 ? createdAt + (startedAt - createdAt) * 0.5 : startedAt + (NOW - startedAt) * (s - 2) / (stageIdx - 1 || 1) * 0.9)
        stageTimes.push(Math.min(ts, NOW - HOUR))
      }
      planned.push({
        id: crypto.randomUUID(),
        title: t.title,
        stage: t.stage,
        createdAt,
        stageTimes,
        closedAt: null,
        assigneeId: team[(i * 3) % team.length]!,
        points: t.points,
        estimateDays: t.estimateDays,
        serviceClass: t.serviceClass ?? 'standard',
        dueDate: t.dueInDays ? NOW + t.dueInDays * DAY : null,
        expeditedAt: t.serviceClass === 'expedite' ? createdAt + 2 * HOUR : null,
      })
    })

    planned.sort((a, b) => a.createdAt - b.createdAt)
    const positions: Record<string, number> = {}

    await db.insert(tasks).values(planned.map(t => ({
      id: t.id,
      workspaceId,
      boardId,
      columnId: colId[t.stage],
      number: 0,
      title: t.title,
      description: '',
      assigneeId: t.assigneeId,
      serviceClass: t.serviceClass,
      dueDate: t.dueDate ? new Date(t.dueDate) : null,
      expeditedAt: t.expeditedAt ? new Date(t.expeditedAt) : null,
      position: (positions[t.stage] = (positions[t.stage] ?? -1) + 1),
      closedAt: t.closedAt ? new Date(t.closedAt) : null,
      storyPoints: t.points,
      estimateDays: t.estimateDays,
      createdAt: new Date(t.createdAt),
      updatedAt: new Date(t.closedAt ?? NOW),
    })))

    await db.insert(taskAssignees).values(planned.map(t => ({
      taskId: t.id, userId: t.assigneeId, workspaceId, addedBy: ownerId, addedAt: new Date(t.createdAt),
    })))

    const events: (typeof taskEvents.$inferInsert)[] = []
    for (const t of planned) {
      events.push({
        workspaceId, taskId: t.id, eventType: 'task_created', fromColumnId: null, toColumnId: colId.backlog,
        actorId: t.assigneeId, payload: { initialPosition: 0 }, createdAt: new Date(t.createdAt),
      })
      t.stageTimes.forEach((ts, idx) => {
        const from = STAGES[idx]!
        const to = STAGES[idx + 1]!
        events.push({
          workspaceId,
          taskId: t.id,
          eventType: to === 'done' ? 'task_closed' : 'task_moved',
          fromColumnId: colId[from],
          toColumnId: colId[to],
          actorId: t.assigneeId,
          payload: { fromPosition: 0, toPosition: 0, fromColumnRole: roleOf[from], toColumnRole: roleOf[to] },
          createdAt: new Date(ts),
        })
      })
    }
    await db.insert(taskEvents).values(events)

    // Five closed two-week sprints behind the active one; closed tasks belong to the sprint they finished in.
    const sprintRows: { id: string, start: number, end: number }[] = []
    const SPRINT_DAYS = 14
    const activeStart = workHour(NOW - 5 * DAY)
    for (let s = 5; s >= 1; s--) {
      const start = activeStart - s * SPRINT_DAYS * DAY
      const end = start + SPRINT_DAYS * DAY
      const [row] = await db.insert(sprints).values({
        workspaceId, boardId,
        name: `Спринт ${11 - s}`,
        goal: '',
        state: 'closed',
        plannedStartAt: new Date(start), plannedEndAt: new Date(end),
        startedAt: new Date(start), endedAt: new Date(end),
        capacity: 34,
      }).returning({ id: sprints.id })
      sprintRows.push({ id: row!.id, start, end })
    }
    const [active] = await db.insert(sprints).values({
      workspaceId, boardId,
      name: 'Спринт 11 – Оплата и курьеры',
      goal: 'Запустить рассрочку и точное время прибытия курьера, не уронив SLA доставки.',
      state: 'active',
      plannedStartAt: new Date(activeStart),
      plannedEndAt: new Date(activeStart + SPRINT_DAYS * DAY),
      startedAt: new Date(activeStart),
      capacity: 34,
    }).returning({ id: sprints.id })

    const sprintLinks: (typeof sprintTasks.$inferInsert)[] = []
    for (const t of planned) {
      if (t.closedAt) {
        const sp = t.closedAt >= activeStart
          ? { id: active!.id, start: activeStart }
          : sprintRows.find(s => t.closedAt! >= s.start && t.closedAt! < s.end)
        if (sp) sprintLinks.push({ sprintId: sp.id, taskId: t.id, workspaceId, addedAt: new Date(sp.start) })
      }
      else if (OPEN_TASKS.find(o => o.title === t.title)?.inSprint) {
        sprintLinks.push({ sprintId: active!.id, taskId: t.id, workspaceId, addedAt: new Date(activeStart) })
      }
    }
    await db.insert(sprintTasks).values(sprintLinks)

    const byTitle = new Map(planned.map(t => [t.title, t.id]))
    await db.insert(taskDependencies).values(DEPENDENCIES.map(([blocker, blocked]) => ({
      blockerTaskId: byTitle.get(blocker)!,
      blockedTaskId: byTitle.get(blocked)!,
      workspaceId,
      createdBy: ownerId,
      createdAt: new Date(activeStart),
    })))

    console.log('\n=== DEMO SEED COMPLETE ===')
    console.log(`workspace: Платформа доставки (/${WORKSPACE_SLUG}), board «Продукт» key ДОС`)
    console.log(`tasks: ${planned.length} (closed ${CLOSED_TITLES.length}, open ${OPEN_TASKS.length}), events: ${events.length}`)
    console.log(`team: ${team.length}, sprints: ${sprintRows.length} closed + 1 active, dependencies: ${DEPENDENCIES.length}`)
    console.log(`login: ${OWNER_EMAIL} (password from SEED_OWNER_PASSWORD or the local default in scripts/seed-demo.ts)`)
    console.log(`workspaceId=${workspaceId} boardId=${boardId} sprintId=${active!.id}`)
  }
  finally {
    await client.end({ timeout: 5 })
  }
}

main().catch((err) => {
  console.error('\nSEED FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
