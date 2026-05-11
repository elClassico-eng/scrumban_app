# Pivot: Nuxt Monorepo (Nitro backend)

**Дата:** 2026-04-23  
**Статус:** Approved  
**Заменяет:** Go + Nuxt split-stack из `docs/archive/2026-04-18-scrumban-platform-design.md` (архивирован)

---

## Контекст и мотивация

Исходный план предполагал отдельный Go-backend. Решение пересмотрено: solo-разработчик с сильным TS/Vue фоном и нулевым опытом Go не сможет быть **автором** Go-backend — только пассивным наблюдателем. На защите это вскроется первым же вопросом об архитектурных решениях.

**Принцип:** лучше полностью понять TS-монолит, чем наполовину понять Go-сервис.

**Качество не страдает.** Nitro — production-ready Node-сервер (SaaS-продукты, агентства, стартапы). Нагрузка MVP (30+ юзеров на команду, ~десятки команд) Node вытягивает без напряжения. Monte Carlo в JS: 1 000–10 000 итераций = 50–150 мс, SSE нативен в H3, фоновые задачи через pg-boss (Postgres-очередь, аналог river).

**Timing идеальный:** код ещё не написан, диаграммы предметной области (ER, Use Case, Class, State Machine) не меняются — они описывают domain, не язык.

---

## Стратегия миграции (A+)

Мы не выбираем между «страховкой» и «явным планом» — берём **pragmatic default**, который даёт optionality без оверинжиниринга.

### Три guardrail'а

| Правило | Механизм |
|---------|----------|
| Frontend не импортирует из `server/` | ESLint `no-restricted-imports` |
| Бизнес-логика в `services/`, не в handlers | Handler ≤ 20 строк; code review |
| Migrations = SQL-файлы в `drizzle/migrations/` | `drizzle-kit generate` коммитит SQL |

### Что это даёт при будущей миграции на Go/Rust/Elixir

- `drizzle/migrations/*.sql` → Goose читает нативно, schema не переписывается
- `openapi/scrumban.yaml` → oapi-codegen генерирует Go-интерфейсы, frontend не трогается
- `server/services/*.ts` → портируются в Go-пакеты по одному, за границей HTTP-контракта

---

## Структура проекта

```
scrumban/
├── app/                          # ✅ Nuxt 4 frontend skeleton (app.vue + pages/index.vue); полноценный UI — Phase 4
│   ├── pages/                    # ✅ только index.vue в Current
│   ├── components/               # ⚠️ Target — папки нет. Триггер: первая реальная страница со своими блоками (Phase 4 frontend kickoff)
│   └── composables/              # ⚠️ Target — папки нет. Триггер: первый shared-хук между ≥ 2 страницами (Phase 4)
├── server/                       # Nitro backend (авто-роутинг по файлам)
│   ├── api/                      # ✅ ~44 endpoint'а (`find server/api -type f -name "*.ts" | wc -l` = 44)
│   │   ├── auth/                 # ✅ login.post.ts, logout.post.ts, register.post.ts, session.get.ts
│   │   ├── workspaces/           # ✅ index.get/post + [id].get + вложенные members/, boards/, и далее columns/, tasks/, sprints/, analytics/ внутри boards/[boardId]/
│   │   ├── boards/               # ⚠️ Target — на верхнем уровне `server/api/` папки нет; handler'ы лежат внутри `workspaces/[id]/boards/...` (tenant-scoped path). Триггер: появление board-операций без workspace-контекста (например, личных досок) — пока не предвидится
│   │   ├── tasks/                # ⚠️ Target — на верхнем уровне нет; handler'ы внутри `workspaces/[id]/boards/[boardId]/tasks/...`. Триггер: тот же — taskи всегда в контексте board+workspace
│   │   └── analytics/            # ⚠️ Target — на верхнем уровне нет; handler'ы внутри `workspaces/[id]/boards/[boardId]/analytics/`. Триггер: cross-board / workspace-wide аналитика (Phase 4+)
│   ├── services/                 # ✅ 8 файлов: analytics, boards, columns, sprints, tasks, users, workspace-members, workspaces
│   │   ├── tasks.service.ts      # ✅
│   │   ├── analytics.service.ts  # ✅
│   │   ├── sprints.service.ts    # ✅
│   │   └── ...                   # ✅ boards / columns / users / workspaces / workspace-members
│   ├── db/
│   │   ├── schema/               # ✅ Drizzle table definitions: boards.ts, sprints.ts, tasks.ts, users.ts, workspaces.ts + index.ts (9 таблиц всего)
│   │   └── queries/              # ⚠️ Target — папки нет; типизированные запросы живут прямо в `server/services/*.service.ts`. Триггер: дедупликация одного и того же SQL'а в ≥ 3 сервисах (раньше rebase'ить в `db/queries/` дороже, чем оставить inline)
│   ├── jobs/                     # ⚠️ Target — папки нет, `pg-boss` не установлен. Триггер: первый async job (email send / webhook dispatch / aggregate refresh / Monte Carlo refresh). См. [`docs/06-system-architecture.md`](../../06-system-architecture.md) → Target → pg-boss workers, [`docs/08-backend-design.md`](../../08-backend-design.md) → Target → middleware/jobs/ff
│   ├── middleware/               # ⚠️ Target — папки нет; auth + tenant guard выполняются в первых 2 строках каждого handler'а (`requireAuth(event)` + `getWorkspaceForUserOrThrow`). Триггер: ≥ 30 endpoint'ов с одинаковой комбинацией guard'ов (boilerplate дороже extraction'а). См. [`docs/08-backend-design.md`](../../08-backend-design.md) → Target → вынос middleware/jobs/ff
│   └── utils/                    # ✅ auth.ts, db.ts (`withTenant`), errors.ts (domain errors + `toHttpError`), events.ts (in-process `EventEmitter`), rbac.ts (5 ролей)
├── shared/                       # типы общие для фронта и бека (Nuxt auto-import)
│   └── types/
│       ├── auth.d.ts             # ✅ расширение `nuxt-auth-utils` сессионных типов
│       └── api.d.ts              # ⚠️ Target — codegen из `openapi/scrumban.yaml` не запущен (frontend ещё не вызывает API). Триггер: ≥ 5 endpoint-вызовов из `app/` (Phase 4 frontend kickoff). См. [`docs/08-backend-design.md`](../../08-backend-design.md) → Target → API contract codegen
├── openapi/
│   └── scrumban.yaml             # ⚠️ Target — папки нет, `@asteasolutions/zod-to-openapi` и `openapi-typescript` не подключены к `package.json`. Триггер: тот же codegen-trigger, что и для `shared/types/api.d.ts`
└── drizzle/
    └── migrations/               # ✅ 7 SQL-миграций (0000–0006), коммитятся вместе с `meta/` snapshot'ами
```

> **Легенда аннотаций:** ✅ — реализовано в Phase 1–3 MVP (см. [`docs/05-mvp-scope-and-roadmap.md`](../../05-mvp-scope-and-roadmap.md)). ⚠️ Target — обоснованно отложено, каждое с измеримым триггером ввода. Полные Target-секции и компонентные триггеры — в сестринских документах: [`docs/06-system-architecture.md`](../../06-system-architecture.md), [`docs/07-domain-model.md`](../../07-domain-model.md), [`docs/08-backend-design.md`](../../08-backend-design.md), [`docs/11-non-functional.md`](../../11-non-functional.md).

**Не используем workspace/монорепу с пакетами** — один `package.json`, один `bun run dev`. Рефакторинг в bun-workspace в Phase 4+, если появится нужда (отдельный admin-frontend, worker-процесс). Это 2-3 часа работы, не блокер.

---

## Стек

### Backend (Nitro / Node)

| Задача | Библиотека | Обоснование |
|--------|-----------|-------------|
| HTTP-сервер | **Nitro + H3** (встроен в Nuxt) | Файл-роутинг, auto-import, SSE нативно |
| ORM / DB | **Drizzle ORM + Drizzle Kit** | Близко к SQL, миграции через SQL-файлы, легко портировать |
| Auth | **nuxt-auth-utils** | Session cookies (HTTP-only), scrypt hash by default (argon2id опционально) |
| Background jobs | **pg-boss** | Postgres-очередь без Redis; аналог river |
| Валидация | **zod** | Стандарт TS, `readValidatedBody`, основа для OpenAPI |
| OpenAPI | **zod-to-openapi + openapi-typescript** | Code-first: zod → YAML → TS-client |
| Логирование | **pino** | JSON structured logs, аналог `slog` |
| Тесты | **vitest + @nuxt/test-utils + testcontainers** | Нативный Vite runner, реальный PG в интеграции |
| Real-time | **H3 createEventStream() + pg LISTEN/NOTIFY** | SSE без WebSocket, кросс-нодовый fan-out через Postgres |

### Frontend

**Nuxt 4** SPA (`ssr: false`), Vue 3, Pinia, TypeScript strict, **Tailwind CSS 4** + **Nuxt UI v4** (база; НЕ NextUI/HeroUI — это для React) + Inspira UI (wow-эффекты) + vue-bits (анимации), @tanstack/vue-query, ECharts, vuedraggable.

> **Hard rule:** всегда latest stable версии стека. Codegen типов между всеми слоями обязателен (Drizzle infer / zod / openapi-typescript). Никаких `any` без явного обоснования. См. `docs/memory/feedback_latest_stack_versions.md`.

### Инфраструктура (без изменений)

PostgreSQL 16+ с RLS, Docker + docker-compose, Caddy, GitHub Actions CI/CD, Yandex Cloud SaaS / MinIO on-prem.

---

## Слой данных

### Drizzle schema

Один к одному с ER-диаграммой. Пример:

```ts
// server/db/schema/tasks.ts
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  title: varchar('title', { length: 255 }).notNull(),
  status: taskStatusEnum('status').notNull().default('backlog'),
  assigneeId: uuid('assignee_id').references(() => users.id),
  closedAt: timestamp('closed_at'),
  reopenedCount: integer('reopened_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

### Миграции

`drizzle-kit generate` → SQL-файл в `drizzle/migrations/`. RLS-политики — отдельный SQL-файл в той же папке (Drizzle не знает про политики, они настраиваются вручную один раз).

### DB-клиент

```ts
// server/utils/db.ts
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

const client = postgres(process.env.DATABASE_URL!)
export const db = drizzle(client, { schema })
```

Nitro auto-import: `useDB()` → возвращает `db`. Один пул на весь процесс.

---

## Auth

Session-based (не JWT). `nuxt-auth-utils` хранит подписанные данные в HTTP-only cookie через `NUXT_SESSION_PASSWORD`.

```ts
// server/api/auth/login.post.ts
const { email, password } = await readValidatedBody(event, LoginSchema.parse)
const user = await UsersService.findByEmail(email)
if (!user || !await verifyPassword(user.passwordHash, password))
  throw createError({ statusCode: 401 })
await setUserSession(event, { userId: user.id })
```

RBAC: `server/middleware/auth.ts` читает сессию, достаёт роль из БД, пишет в `event.context.user`. Handlers не занимаются auth-проверками напрямую.

---

## Background jobs

pg-boss инициализируется при старте Nitro через Nitro plugin:

```ts
// server/plugins/jobs.ts
export default defineNitroPlugin(async () => {
  const boss = new PgBoss(process.env.DATABASE_URL!)
  await boss.start()
  boss.work('analytics.recalculate', async job => {
    await AnalyticsService.recalculate(job.data.sprintId)
  })
})
```

Постановка задачи из сервиса: `await boss.send('analytics.recalculate', { sprintId })`.

Отдельный worker-процесс не нужен до Phase 4+.

---

## Real-time (SSE)

```ts
// server/api/boards/[id]/stream.get.ts
export default defineEventHandler(async event => {
  const boardId = getRouterParam(event, 'id')
  const stream = createEventStream(event)
  const pgClient = await getNotifyClient()
  
  await pgClient.query(`LISTEN board_${boardId}`)
  pgClient.on('notification', msg => stream.push(msg.payload!))
  event.node.req.on('close', () => {
    pgClient.query(`UNLISTEN board_${boardId}`)
    stream.close()
  })
  return stream.send()
})
```

Frontend: `useEventSource('/api/boards/1/stream')` composable. Паттерн аналогичен исходному плану с Go.

---

## OpenAPI-контракт

Code-first от zod-схем:

1. `server/api/**/*.ts` определяют zod-схемы для input/output
2. `scripts/generate-openapi.ts` собирает их через `zod-to-openapi` → `openapi/scrumban.yaml`
3. `bun run codegen` запускает `openapi-typescript` → `shared/types/api.d.ts`
4. Frontend импортирует только из `shared/types/`, никогда из `server/`

`scrumban.yaml` коммитим в git — это артефакт контракта, не временный файл.

---

## Тестирование

| Тип | Инструмент | Что покрывает |
|-----|-----------|---------------|
| Unit | vitest | services/, utils/, pure functions |
| Integration | vitest + testcontainers/postgresql | DB queries, migrations, RLS |
| E2E API | @nuxt/test-utils | HTTP handlers end-to-end |
| Frontend | @nuxt/test-utils + playwright | компоненты, flows |

Тест-стратегия: критические сервисы (tasks, analytics, auth) — TDD. UI — по необходимости.

---

## Потоки данных

```
HTTP:
  Nuxt page → fetch('/api/tasks') → Nitro handler
  → readValidatedBody (zod) → TasksService → db.query (Drizzle)
  → PostgreSQL (RLS фильтрует по workspace) → response

Real-time:
  PostgreSQL NOTIFY → pg LISTEN клиент в Nitro
  → SSE stream → useEventSource() в Vue composable
  → Pinia store update → реактивный UI

Analytics (async):
  sprint.close() → boss.send('analytics.recalculate')
  → pg-boss job queue → AnalyticsService.recalculate()
  → UPDATE sprint_stats → NOTIFY analytics_updated
  → SSE → UI обновление
```

---

## Что меняется в существующих документах

### Полная замена

- `docs/08-backend-design.md` — Go → Nitro архитектура
- `docs/superpowers/plans/2026-04-18-phase0-week1-notes-api.md` — Go notes-api → Nuxt+Nitro+Drizzle starter

### Существенные правки

- `docs/06-system-architecture.md` — tech stack секция
- `docs/12-deployment.md` — Dockerfile под Node (`node:22-alpine`), не Go binary
- `docs/11-non-functional.md` — auth секция (библиотека меняется, argon2id остаётся)
- `docs/uml/04-component/components.puml` — lifeline «Go Backend» → «Nitro Server»
- `docs/uml/06-sequence/*.puml` — участник «Go Service» → «Nitro API»

### Лёгкие правки (стек-секции)

- `docs/05-mvp-scope-and-roadmap.md`
- `docs/README.md`
- `CLAUDE.md` — стек секция
- `COMPACT.md` — статус и стек
- `docs/memory/project_core_decisions.md`
- `docs/superpowers/specs/2026-04-18-scrumban-platform-design.md` — стек секция

### Не трогаем

- `docs/uml/01-use-case/` — предметная область
- `docs/uml/02-class/` — доменная модель
- `docs/uml/07-state/` — lifecycle задач и спринтов
- `docs/01-vision-and-goals.md`, `02-target-audience.md`, `03-competitive-analysis.md`, `04-economic-rationale.md`, `10-analytics-design.md`
- Все `learning/` папки

---

## Что НЕ меняется принципиально

- PostgreSQL 16+ с RLS — без изменений
- Аналитика (CFD, Monte Carlo, Little's Law) — те же формулы, тот же подход
- Multi-tenancy через RLS — те же политики
- SSE для real-time — тот же паттерн
- Event-sourced аналитика (`task_events` таблица) — без изменений
- Методология Scrumban, все продуктовые решения — без изменений

---

## Phase 0 (новый план)

Вместо Go notes-api pet-project — **Nuxt Nitro starter**:

```
~/Волгу/магистратура/nuxt-notes-api/
```

За неделю: Nuxt + Nitro, Drizzle + PostgreSQL (Docker), CRUD для notes, базовая auth через nuxt-auth-utils, pino логирование, vitest unit-тесты, один integration-тест с testcontainers. Деплой: `docker-compose up`.

Цель та же — понять полный backend-стек на простом примере до MVP.
