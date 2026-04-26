# 08 — Backend Design

## Подход

Backend реализуется на **Nitro** (HTTP-движок Nuxt 4) с **прогрессивной сложностью**: начинаем с минимального набора концепций — handler, service, db query, — наращиваем слои только когда они реально нужны. Целевая архитектура — production-grade модульный монолит; начальная архитектура — «работающий API и ничего лишнего».

Стек end-to-end на TypeScript: один язык, общие типы между frontend и backend, минимум context switching. Backend живёт в `server/` той же Nuxt-монорепы, что и frontend в `app/`.

## Current (MVP, месяцы 1–3)

### Структура (внутри Nuxt monorepo)
```
scrumban/
├── app/                       # Nuxt frontend (отдельная история)
├── server/                    # Nitro backend
│   ├── api/                   # HTTP handlers (файл-роутинг)
│   │   ├── auth/              # login.post.ts, logout.post.ts, session.get.ts, register.post.ts
│   │   ├── workspaces/
│   │   ├── boards/
│   │   ├── tasks/
│   │   └── analytics/
│   ├── services/              # бизнес-логика (pure TS-функции)
│   │   ├── tasks.service.ts
│   │   ├── sprints.service.ts
│   │   ├── analytics.service.ts
│   │   └── ...
│   ├── db/
│   │   ├── schema/            # Drizzle table definitions (*.ts)
│   │   └── queries/           # типизированные запросы
│   ├── middleware/            # auth, rbac, tenant
│   ├── plugins/               # Nitro plugins (logger init, pg-boss start)
│   └── utils/                 # db.ts, session.ts, sse.ts
├── shared/types/              # типы общие для frontend и backend (Nuxt auto-import)
├── openapi/scrumban.yaml      # сгенерированная спека (коммитим)
├── drizzle/migrations/        # SQL-файлы от drizzle-kit generate
├── nuxt.config.ts
└── package.json
```

### Пять вещей, которые нужно понимать в первый месяц

1. **HTTP handler (Nitro / H3):** файл `server/api/tasks/index.post.ts` экспортирует `defineEventHandler(async event => ...)`. Файл-роутинг: путь файла = URL. Метод (`.post`, `.get`) — тоже из имени.
2. **Drizzle:** ORM на TypeScript. Schema в `server/db/schema/tasks.ts`. Запросы — `db.select().from(tasks).where(eq(tasks.id, id))`. Никакой DSL, читается как SQL.
3. **Миграции (Drizzle Kit):** меняешь schema → `pnpm db:generate` → создаётся SQL-файл в `drizzle/migrations/`. `pnpm db:migrate` применяет.
4. **Sessions через nuxt-auth-utils:** при логине `setUserSession(event, { userId })` ставит подписанный HTTP-only cookie. На запросах `getUserSession(event)` читает.
5. **Docker для dev:** `docker-compose.yml` поднимает PostgreSQL. Nitro dev-сервер запускается через `pnpm dev`.

### Библиотеки (MVP minimal)
- `nuxt` (4.x) + `h3` — HTTP-сервер встроен в Nuxt.
- `drizzle-orm` + `drizzle-kit` — ORM и миграции.
- `postgres` (postgres-js) — Postgres driver.
- `nuxt-auth-utils` — session cookies + password hashing (scrypt by default; argon2id configurable).
- `zod` — runtime-валидация input + источник OpenAPI-спеки.
- `pino` — structured JSON logs.
- `pg-boss` — фоновые задачи на Postgres (когда понадобится).
- `vitest` + `@nuxt/test-utils` + `@testcontainers/postgresql` — тесты.

### Авторизация в MVP
- Argon2id для паролей через `hashPassword()` / `verifyPassword()` из nuxt-auth-utils.
- Сессии: подписанный HTTP-only cookie с user_id (не JWT). Подпись через `NUXT_SESSION_PASSWORD` env.
- Expire: 7 дней sliding (продлевается при активности через middleware).
- Logout: `clearUserSession(event)` → cookie очищается.

### Пример handler'а (illustrative)
```typescript
// server/api/tasks/index.post.ts
import { z } from 'zod'
import { createTask } from '../../services/tasks.service'
import { requireAuth } from '../../utils/auth'

const CreateTaskSchema = z.object({
  title: z.string().min(1).max(255),
  boardId: z.string().uuid(),
  assigneeId: z.string().uuid().optional(),
})

export default defineEventHandler(async event => {
  const userId = await requireAuth(event)
  const body = await readValidatedBody(event, CreateTaskSchema.parse)
  return createTask({ userId, ...body })
})
```

Три слоя: middleware (auth, tenant), handler (валидация), service (логика). Этого достаточно на месяц.

### Тесты в MVP
- Unit-тесты на чистые функции (расчёты, маппинг) через vitest.
- Integration-тесты с реальным Postgres через `@testcontainers/postgresql` (поднимает контейнер на каждый run).
- Покрытие: 50–60% достаточно, не гонимся за метрикой. Критические пути (auth, tasks, RLS) — TDD.

## Target (к защите)

### Обогащённая структура
```
server/
├── api/                       # handlers (тонкие, ≤20 строк)
├── services/                  # бизнес-логика (толстые, тестируемые)
├── db/
│   ├── schema/                # Drizzle definitions
│   ├── queries/               # сложные запросы (отдельно от schema)
│   └── transactions/          # многошаговые операции
├── middleware/
│   ├── auth.ts                # сессии → event.context.user
│   ├── tenant.ts              # SET app.workspace_id для RLS
│   └── rbac.ts                # проверка ролей
├── plugins/
│   ├── logger.ts              # pino init
│   ├── jobs.ts                # pg-boss start + register workers
│   └── shutdown.ts            # graceful shutdown
├── jobs/                      # pg-boss worker functions
│   ├── analytics.recalculate.ts
│   └── notifications.send.ts
├── events/                    # in-process event bus + pg LISTEN/NOTIFY publisher
├── sse/                       # SSE hub utilities
├── analytics/                 # CFD, Monte Carlo, Little's Law
├── ff/                        # feature flags helper
└── utils/
    ├── db.ts
    ├── session.ts
    ├── errors.ts              # маппинг domain errors → HTTP
    └── tracing.ts
```

### Ключевые паттерны
- **Handlers тонкие, services толстые.** Handler ≤20 строк: парсинг, вызов сервиса, форматирование. Вся логика в `services/`.
- **Pure functions where possible.** Сервисы не зависят от `H3Event` напрямую — принимают plain объекты. Это упрощает тесты.
- **Domain errors:** `class NotFoundError extends Error`, `ForbiddenError`, `ConflictError`, `WIPBreachedError`. Helper `mapError(err)` в `server/utils/errors.ts` мапит в HTTP-коды.
- **Дисциплина импортов:** `api/` → `services/` → `db/`. Никаких обратных импортов. ESLint-правило `no-restricted-imports`.
- **Frontend никогда не импортирует из `server/`.** Граница — `openapi/scrumban.yaml` + сгенерированные TS-типы в `shared/types/api.d.ts`.

### OpenAPI-first workflow (code-first)
1. Меняешь zod-схему в `server/api/...` (например, добавляешь поле в `CreateTaskSchema`).
2. `pnpm openapi:generate` → `zod-to-openapi` пересобирает `openapi/scrumban.yaml`.
3. `pnpm codegen` → `openapi-typescript` обновляет `shared/types/api.d.ts`.
4. TypeScript-компилятор показывает frontend-местам, где типы изменились.
5. (Опционально) `pnpm contract:test` → проверка реализации против spec.

### Расширенные тесты
- Unit (vitest) + Integration (vitest + testcontainers/postgresql).
- E2E API (`@nuxt/test-utils` поднимает Nitro и бьёт по HTTP).
- Snapshot (analytics результаты).
- **RLS guard test** — попытка cross-tenant доступа → 0 строк.
- Load (k6) — перед защитой для главы о производительности.

### Библиотеки (Target добавки к MVP)
- `pg-boss` — фоновые задачи на Postgres (аналог river из Go-мира).
- `zod-to-openapi` (или `@asteasolutions/zod-to-openapi`) — генерация OpenAPI YAML из zod-схем.
- `openapi-typescript` — генерация TS-типов из OpenAPI YAML.
- `@nuxt/test-utils` — e2e-тесты с поднятой Nuxt-инстанцией.
- (Опционально) `schemathesis` через CLI — contract testing.

## Evolution

### Путь из Current в Target
1. **Когда `server/api/` начинает разбухать** → выделить `services/` и переносить логику.
2. **Когда появляется 2+ разных реакции на одно изменение** (например, нужно и SSE-broadcast, и notification) → ввести event bus.
3. **Когда появляется 2+ реплики backend'а** → Postgres LISTEN/NOTIFY для SSE (один реплика NOTIFY, все слышат).
4. **Когда вручную поддерживать типы между server и frontend начинает раздражать** → подключить openapi-typescript codegen.
5. **Когда baseline нагрузка аналитики начинает замедлять основной API** → вынести pg-boss workers в отдельный Node-процесс (тот же кодбейс, отдельный entry).
6. **Когда команда разрастается** → ESLint `no-restricted-imports` обязателен; добавить `dependency-cruiser` для архитектурных правил.

### Сигналы «пора рефакторить»
- Файл `>500 строк` — время разбивать.
- Handler `>20 строк` — бизнес-логика в `services/`.
- «Этот код я видел где-то в другом месте» — помощник в отдельный файл.
- Тесты стали долго гоняться — вынести интеграционные в отдельный suite.

## Обработка ошибок

### Domain-errors
```typescript
// server/utils/errors.ts
export class NotFoundError extends Error {}
export class ForbiddenError extends Error {}
export class ConflictError extends Error {}
export class ValidationError extends Error {}
export class WIPBreachedError extends Error {}

export function mapError(err: unknown) {
  if (err instanceof NotFoundError) return createError({ statusCode: 404, message: err.message })
  if (err instanceof ForbiddenError) return createError({ statusCode: 403, message: err.message })
  if (err instanceof ConflictError) return createError({ statusCode: 409, message: err.message })
  if (err instanceof ValidationError) return createError({ statusCode: 422, message: err.message })
  // default — 500
  return createError({ statusCode: 500, message: 'Internal error' })
}
```

### Использование
```typescript
// services/tasks.service.ts
export async function getTask(id: string, userId: string) {
  const task = await db.select().from(tasks).where(...).then(r => r[0])
  if (!task) throw new NotFoundError(`task ${id} not found`)
  if (task.assigneeId !== userId) throw new ForbiddenError('not your task')
  return task
}

// api/tasks/[id].get.ts
export default defineEventHandler(async event => {
  try {
    const userId = await requireAuth(event)
    const id = getRouterParam(event, 'id')!
    return await getTask(id, userId)
  } catch (err) {
    throw mapError(err)
  }
})
```

### Логирование
Только на границе (через Nitro middleware или error hook). В services и db — только `throw`. Один источник правды для логов запросов.

## Observability

### MVP
- Structured logs через `pino` (JSON-формат).
- Request IDs в middleware (добавляется к каждому лог-сообщению).
- Basic metrics: количество запросов, latency (Prometheus-стиль через middleware, опционально).

### Target
- Sentry для ошибок (через `@sentry/node`).
- OpenTelemetry traces для ключевых операций.
- Dashboards: p50/p95/p99 latency, error rate, DB query time.

## Связанные документы
- [`06-system-architecture.md`](06-system-architecture.md) — компоненты системы
- [`07-domain-model.md`](07-domain-model.md) — схема БД
- [`09-frontend-design.md`](09-frontend-design.md) — клиент (Nuxt SPA)
- [`10-analytics-design.md`](10-analytics-design.md) — analytics engine
- [`11-non-functional.md`](11-non-functional.md) — RLS, RBAC, auth
- [`superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`](superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md) — pivot spec
