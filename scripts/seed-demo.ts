import { eq, like } from 'drizzle-orm'
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

type ColRole = 'backlog' | 'in_progress' | 'review' | 'done'
type ServiceClassValue = 'expedite' | 'fixed_date' | 'standard' | 'intangible'

type Cols = Record<ColRole, string>

type SeedTask = {
  id: string
  title: string
  storyPoints: number
  serviceClass: ServiceClassValue
  assigneeId: string
  createdAt: Date
  closedAt: Date | null
  currentRole: ColRole
  dueDate: Date | null
  expeditedAt: Date | null
}

const DAY = 86_400_000
const HOUR = 3_600_000
const NOW = new Date('2026-06-14T12:00:00.000Z')

function mulberry32(seed: number): () => number {
  let a = seed
  return () => {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rnd = mulberry32(20260614)

function pick<T>(arr: T[]): T {
  return arr[Math.floor(rnd() * arr.length)]!
}
function jitterHours(base: number, spread: number): number {
  return base + Math.floor((rnd() - 0.5) * 2 * spread)
}

const DEMO_EMAILS = ['anna@demo.seed', 'igor@demo.seed', 'maria@demo.seed']
const PLACEHOLDER_HASH = 'demo-seed-not-a-real-hash:noscrypt'

const MEMBER_DEFS = [
  { email: 'anna@demo.seed', firstName: 'Анна', lastName: 'Соколова', jobTitle: 'Frontend-разработчик' },
  { email: 'igor@demo.seed', firstName: 'Игорь', lastName: 'Лебедев', jobTitle: 'Backend-разработчик' },
  { email: 'maria@demo.seed', firstName: 'Мария', lastName: 'Орлова', jobTitle: 'QA-инженер' },
]

const CLOSED_TITLES = [
  'Вёрстка страницы профиля', 'Интеграция с GitFlic OAuth', 'Фикс гонки в SSE-переподключении',
  'Миграция на Drizzle 0.45', 'Ретенция: онбординг-чеклист', 'Тёмная тема для доски',
  'Экспорт CFD в PNG', 'Кэширование аналитики на vue-query', 'Рефактор очереди pg-boss',
  'Валидация форм через zod', 'Адаптив для мобильной доски', 'Drag-n-drop колонок',
  'Уведомления о назначении задач', 'Поиск по задачам', 'Лейблы и фильтры на доске',
  'Свимлейны по классу обслуживания', 'Метрика cycle time на карточке', 'WIP-лимиты с подсветкой',
  'Архивирование завершённых спринтов', 'Импорт задач из CSV', 'Бёрндаун-чарт спринта',
  'Роли и RBAC в воркспейсе', 'Аватары пользователей через MinIO', 'Восстановление пароля по email',
  'Логирование через pino', 'Health-check эндпоинт', 'Rate-limit на auth-роуты',
]

const OPEN_TITLES = [
  'Прогноз срока спринта (CPM/PERT)', 'Monte Carlo на странице аналитики', 'Граф зависимостей задач',
  'Каденс пополнения бэклога', 'SLE-дашборд по доске', 'Интеграция с Pachca (уведомления)',
  'Вебхуки в GitFlic CI', 'Настройка Caddy + TLS', 'Бэкап Postgres по расписанию',
  'Темплейт лендинга со скриншотами', 'Drill-down по scatter cycle time', 'Алерты о застрявших задачах',
]

async function main() {
  const url = process.env.DATABASE_URL_ADMIN ?? process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL_ADMIN / DATABASE_URL not set — check .env')

  const ownerEmail = (process.env.SEED_OWNER_EMAIL ?? '').trim().toLowerCase()
  if (!ownerEmail) {
    throw new Error('SEED_OWNER_EMAIL is required. Run: SEED_OWNER_EMAIL=you@example.com bun run db:seed')
  }

  const client = postgres(url, { max: 4 })
  const db = drizzle(client, { schema: { tasks } })

  try {
    const [owner] = await db.select().from(users).where(eq(users.email, ownerEmail))
    if (!owner) {
      throw new Error(
        `Owner user "${ownerEmail}" not found. Register/login with that email in the app first, then re-run the seed (the seed never creates the owner to avoid password-hash issues).`,
      )
    }

    await db.delete(workspaces).where(eq(workspaces.slug, 'demo-flow'))
    await db.delete(users).where(like(users.email, '%@demo.seed'))

    const memberRows = await db
      .insert(users)
      .values(
        MEMBER_DEFS.map((m) => ({
          email: m.email,
          passwordHash: PLACEHOLDER_HASH,
          firstName: m.firstName,
          lastName: m.lastName,
          jobTitle: m.jobTitle,
        })),
      )
      .returning({ id: users.id, email: users.email })
    const memberIdByEmail = new Map(memberRows.map((r) => [r.email, r.id]))
    const memberIds = DEMO_EMAILS.map((e) => memberIdByEmail.get(e)!)
    const assigneePool = [owner.id, ...memberIds]

    const [ws] = await db
      .insert(workspaces)
      .values({
        name: 'Demo Flow',
        slug: 'demo-flow',
        description: 'Демонстрационный воркспейс для скриншотов лендинга.',
        industry: 'Software',
      })
      .returning({ id: workspaces.id })
    const workspaceId = ws!.id

    await db.insert(workspaceMembers).values([
      { workspaceId, userId: owner.id, role: 'owner' },
      ...memberIds.map((userId) => ({ workspaceId, userId, role: 'member' as const })),
    ])

    const [board] = await db
      .insert(boards)
      .values({
        workspaceId,
        name: 'Поток',
        slug: 'potok',
        color: '#e85002',
        sleDays: 7,
        sleProbability: '0.85',
      })
      .returning({ id: boards.id })
    const boardId = board!.id

    const columnDefs: { name: string; role: ColRole; wipLimit: number | null }[] = [
      { name: 'Бэклог', role: 'backlog', wipLimit: null },
      { name: 'В работе', role: 'in_progress', wipLimit: 4 },
      { name: 'Ревью', role: 'review', wipLimit: 3 },
      { name: 'Готово', role: 'done', wipLimit: null },
    ]
    const insertedCols = await db
      .insert(boardColumns)
      .values(
        columnDefs.map((c, i) => ({
          workspaceId,
          boardId,
          name: c.name,
          position: i,
          wipLimit: c.wipLimit,
          columnRole: c.role,
        })),
      )
      .returning({ id: boardColumns.id, columnRole: boardColumns.columnRole })
    const cols = Object.fromEntries(
      insertedCols.map((c) => [c.columnRole, c.id]),
    ) as Cols

    const seedTasks: SeedTask[] = []
    const positionByCol: Record<string, number> = { [cols.backlog]: 0, [cols.in_progress]: 0, [cols.review]: 0, [cols.done]: 0 }

    const storyPointPool = [1, 2, 3, 3, 5, 5, 8]
    const cycleDayPool = [2, 2, 3, 3, 4, 4, 5, 5, 6, 7, 8, 9, 11, 13, 16]

    const expediteIdx = new Set([3, 11, 19])
    const fixedDateIdx = new Set([6, 14])

    for (let i = 0; i < CLOSED_TITLES.length; i++) {
      const cycleDays = pick(cycleDayPool)
      const ageDays = 2 + Math.floor(rnd() * 39)
      const closedAt = new Date(NOW.getTime() - ageDays * DAY + jitterHours(0, 6) * HOUR)
      const createdAt = new Date(closedAt.getTime() - cycleDays * DAY - jitterHours(4, 3) * HOUR)
      let serviceClass: ServiceClassValue = 'standard'
      if (expediteIdx.has(i)) serviceClass = 'expedite'
      else if (fixedDateIdx.has(i)) serviceClass = 'fixed_date'
      const dueDate = serviceClass === 'fixed_date' ? new Date(closedAt.getTime() + 2 * DAY) : null
      const expeditedAt = serviceClass === 'expedite' ? new Date(createdAt.getTime() + 6 * HOUR) : null
      seedTasks.push({
        id: crypto.randomUUID(),
        title: CLOSED_TITLES[i]!,
        storyPoints: pick(storyPointPool),
        serviceClass,
        assigneeId: assigneePool[i % assigneePool.length]!,
        createdAt,
        closedAt,
        currentRole: 'done',
        dueDate,
        expeditedAt,
      })
    }

    const openColRoles: ColRole[] = [
      'backlog', 'backlog', 'backlog', 'backlog',
      'in_progress', 'in_progress', 'in_progress',
      'review', 'review',
      'in_progress',
      'backlog', 'review',
    ]
    for (let i = 0; i < OPEN_TITLES.length; i++) {
      const role = openColRoles[i]!
      const createdAt = new Date(NOW.getTime() - (3 + Math.floor(rnd() * 18)) * DAY)
      let serviceClass: ServiceClassValue = 'standard'
      let dueDate: Date | null = null
      let expeditedAt: Date | null = null
      if (i === 0) {
        serviceClass = 'expedite'
        expeditedAt = new Date(createdAt.getTime() + 4 * HOUR)
      } else if (i === 1) {
        serviceClass = 'fixed_date'
        dueDate = new Date(NOW.getTime() + 5 * DAY)
      }
      seedTasks.push({
        id: crypto.randomUUID(),
        title: OPEN_TITLES[i]!,
        storyPoints: pick(storyPointPool),
        serviceClass,
        assigneeId: assigneePool[i % assigneePool.length]!,
        createdAt,
        closedAt: null,
        currentRole: role,
        dueDate,
        expeditedAt,
      })
    }

    const roleOrder: ColRole[] = ['backlog', 'in_progress', 'review', 'done']
    const taskRows: (typeof tasks.$inferInsert)[] = []
    const eventRows: (typeof taskEvents.$inferInsert)[] = []
    const assigneeRows: (typeof taskAssignees.$inferInsert)[] = []

    for (const t of seedTasks) {
      const columnId = cols[t.currentRole]
      taskRows.push({
        id: t.id,
        workspaceId,
        boardId,
        columnId,
        title: t.title,
        description: '',
        assigneeId: t.assigneeId,
        serviceClass: t.serviceClass,
        dueDate: t.dueDate,
        expeditedAt: t.expeditedAt,
        position: positionByCol[columnId]!++,
        closedAt: t.closedAt,
        storyPoints: t.storyPoints,
        createdAt: t.createdAt,
        updatedAt: t.closedAt ?? NOW,
      })
      assigneeRows.push({ taskId: t.id, userId: t.assigneeId, workspaceId, addedBy: t.assigneeId, addedAt: t.createdAt })

      const targetIdx = roleOrder.indexOf(t.currentRole)
      const endTs = (t.closedAt ?? NOW).getTime()
      const startTs = t.createdAt.getTime()
      const span = Math.max(endTs - startTs, HOUR)
      const stepCount = Math.max(targetIdx, 1)

      eventRows.push({
        workspaceId,
        taskId: t.id,
        eventType: 'task_created',
        fromColumnId: null,
        toColumnId: cols.backlog,
        actorId: t.assigneeId,
        payload: { initialPosition: 0 },
        createdAt: t.createdAt,
      })

      for (let step = 1; step <= targetIdx; step++) {
        const fromRole = roleOrder[step - 1]!
        const toRole = roleOrder[step]!
        const ts = new Date(startTs + (span * step) / (stepCount + 1) + jitterHours(0, 1) * HOUR)
        const enteringDone = toRole === 'done'
        const moveTs = enteringDone && t.closedAt ? t.closedAt : ts
        eventRows.push({
          workspaceId,
          taskId: t.id,
          eventType: enteringDone ? 'task_closed' : 'task_moved',
          fromColumnId: cols[fromRole],
          toColumnId: cols[toRole],
          actorId: t.assigneeId,
          payload: {
            fromPosition: 0,
            toPosition: 0,
            fromColumnRole: fromRole,
            toColumnRole: toRole,
          },
          createdAt: moveTs,
        })
      }
    }

    await db.insert(tasks).values(taskRows)
    await db.insert(taskAssignees).values(assigneeRows)
    await db.insert(taskEvents).values(eventRows)

    const openTasks = seedTasks.filter((t) => t.closedAt === null)
    const recentClosed = [...seedTasks]
      .filter((t) => t.closedAt !== null)
      .sort((a, b) => b.closedAt!.getTime() - a.closedAt!.getTime())
      .slice(0, 2)
    const sprintTaskList = [...openTasks.slice(0, 8), ...recentClosed]

    const [sprint] = await db
      .insert(sprints)
      .values({
        workspaceId,
        boardId,
        name: 'Спринт 7 — Аналитика и прогноз',
        goal: 'Запустить CPM/PERT-прогноз спринта и Monte Carlo на странице аналитики.',
        state: 'active',
        plannedStartAt: new Date(NOW.getTime() - 7 * DAY),
        plannedEndAt: new Date(NOW.getTime() + 7 * DAY),
        startedAt: new Date(NOW.getTime() - 7 * DAY),
        capacity: 40,
      })
      .returning({ id: sprints.id })
    const sprintId = sprint!.id

    await db.insert(sprintTasks).values(
      sprintTaskList.map((t) => ({
        sprintId,
        taskId: t.id,
        workspaceId,
        addedAt: new Date(NOW.getTime() - 7 * DAY),
      })),
    )

    const byTitle = (title: string) => openTasks.find((t) => t.title === title)!
    const chain: [string, string][] = [
      ['Граф зависимостей задач', 'Прогноз срока спринта (CPM/PERT)'],
      ['Прогноз срока спринта (CPM/PERT)', 'Monte Carlo на странице аналитики'],
      ['Monte Carlo на странице аналитики', 'SLE-дашборд по доске'],
      ['Граф зависимостей задач', 'Каденс пополнения бэклога'],
      ['Каденс пополнения бэклога', 'SLE-дашборд по доске'],
    ]
    const depRows = chain
      .map(([blocker, blocked]) => ({ b: byTitle(blocker), d: byTitle(blocked) }))
      .filter((r) => r.b && r.d && sprintTaskList.includes(r.b) && sprintTaskList.includes(r.d))
      .map((r) => ({
        blockerTaskId: r.b.id,
        blockedTaskId: r.d.id,
        workspaceId,
        createdBy: owner.id,
        createdAt: new Date(NOW.getTime() - 6 * DAY),
      }))
    await db.insert(taskDependencies).values(depRows)

    const closedCount = seedTasks.filter((t) => t.closedAt !== null).length
    console.log('\n=== DEMO SEED COMPLETE ===')
    console.log(`tasks:        ${seedTasks.length} (closed: ${closedCount}, open: ${openTasks.length})`)
    console.log(`task_events:  ${eventRows.length}`)
    console.log(`members:      ${memberIds.length} (+ owner ${ownerEmail})`)
    console.log(`dependencies: ${depRows.length}`)
    console.log(`sprint tasks: ${sprintTaskList.length}`)
    console.log(`workspaceId:  ${workspaceId}`)
    console.log(`boardId:      ${boardId}`)
    console.log(`sprintId:     ${sprintId}`)
    console.log(`\nLog in as ${ownerEmail} and open the Demo Flow board → Аналитика / Спринты.`)
  } finally {
    await client.end({ timeout: 5 })
  }
}

main().catch((err) => {
  console.error('\nSEED FAILED:', err instanceof Error ? err.message : err)
  process.exit(1)
})
