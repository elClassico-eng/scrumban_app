# 08 — Backend Design

## Подход

Backend реализуется на **Nitro** (HTTP-движок Nuxt 4) с **прогрессивной сложностью**: начинаем с минимального набора концепций — handler, service, db query, — наращиваем слои только когда они реально нужны. Целевая архитектура — production-grade модульный монолит; начальная архитектура — «работающий API и ничего лишнего».

Стек end-to-end на TypeScript: один язык, общие типы между frontend и backend, минимум context switching. Backend живёт в `server/` той же Nuxt-монорепы, что и frontend в `app/`.

Документ описывает **Current** (что реально лежит в `server/` к 2026-05-10) и **Target** (куда расширяемся при понятных триггерах). Каждая Target-секция начинается с измеримого условия ввода.

Связанные документы: [`docs/06-system-architecture.md`](06-system-architecture.md) — компоненты системы; [`docs/07-domain-model.md`](07-domain-model.md) — схема БД; [`docs/11-non-functional.md`](11-non-functional.md) — auth/RBAC/RLS/observability; [`docs/uml/01-use-case/roles-guide.md`](uml/01-use-case/roles-guide.md) — таблица ролей и required-role per endpoint.

---

## Структура `server/`

### Current — реальная структура

```
server/
├── api/                                # H3 file-routing handlers (~44 endpoints)
│   ├── healthz.get.ts
│   ├── auth/                           # login, register, logout, session
│   │   ├── login.post.ts
│   │   ├── logout.post.ts
│   │   ├── register.post.ts
│   │   └── session.get.ts
│   └── workspaces/
│       ├── index.get.ts                # list workspaces of current user
│       ├── index.post.ts               # create workspace
│       └── [id]/
│           ├── [id].get.ts
│           ├── boards/                 # CRUD + columns + tasks + sprints + analytics + SSE stream
│           │   ├── index.get.ts
│           │   ├── index.post.ts
│           │   └── [boardId]/
│           │       ├── columns/        # CRUD + reorder
│           │       ├── tasks/          # CRUD + move + per-task events log
│           │       ├── sprints/        # CRUD + start/close + sprint↔task join
│           │       ├── analytics/      # cfd, throughput, cycle-time, monte-carlo, wip-recommendations
│           │       └── stream.get.ts   # SSE endpoint for real-time board updates
│           └── members/                # RBAC-aware member ops (invite/remove/role change)
├── services/                           # бизнес-логика, чистые TS-функции
│   ├── analytics.service.ts            # CFD, throughput, cycle-time, MC, Little's Law
│   ├── boards.service.ts
│   ├── columns.service.ts
│   ├── sprints.service.ts
│   ├── tasks.service.ts
│   ├── users.service.ts
│   ├── workspace-members.service.ts
│   └── workspaces.service.ts
├── db/
│   └── schema/                         # Drizzle table definitions, 9 tables
│       ├── boards.ts                   # boards, board_columns
│       ├── index.ts                    # aggregate re-export for db client + Drizzle Kit
│       ├── sprints.ts                  # sprints, sprint_tasks
│       ├── tasks.ts                    # tasks, task_events
│       ├── users.ts                    # users
│       └── workspaces.ts               # workspaces, workspace_members
└── utils/
    ├── auth.ts                         # requireAuth(event) — session-or-401
    ├── db.ts                           # useDB() singleton + withTenant() RLS helper
    ├── errors.ts                       # domain errors + toHttpError mapper
    ├── events.ts                       # in-process EventEmitter pub/sub for SSE
    └── rbac.ts                         # roleAtLeast / requireMinRole / strictlyOutranks
```

Ключевые файлы исходного кода:

- [`server/utils/db.ts`](../server/utils/db.ts) — Drizzle-клиент + `withTenant(workspaceId, fn)`-обёртка, ставящая `app.workspace_id` через `set_config('app.workspace_id', $1, true)` (transaction-scoped, эквивалент `SET LOCAL`, но принимает плейсхолдер).
- [`server/utils/errors.ts`](../server/utils/errors.ts) — domain-классы `NotFoundError` / `ForbiddenError` / `ConflictError` / `ValidationError` / `UnauthorizedError` + `toHttpError(err)` маппер; используется как `try { ... } catch (e) { throw toHttpError(e) }` на границе handler'а.
- [`server/utils/rbac.ts`](../server/utils/rbac.ts) — единственный источник упорядочивания ролей `viewer < member < scrum_master < admin < owner`; функции `roleAtLeast`, `requireMinRole`, `strictlyOutranks`.
- [`server/utils/events.ts`](../server/utils/events.ts) — `node:events` EventEmitter с per-board каналом `board:<boardId>`; сервисы вызывают `publishBoardEvent` после успешной транзакции, SSE-handler `stream.get.ts` подписывается через `subscribeBoardEvents`.
- [`server/utils/auth.ts`](../server/utils/auth.ts) — тонкий `requireAuth(event)`, читает сессию через nuxt-auth-utils, кидает `UnauthorizedError`.

**Важно — папок `middleware/`, `sse/`, `events/`, `analytics/`, `ff/`, `jobs/`, `plugins/` в `server/` нет.** Паттерны, которые они бы держали, сегодня живут иначе:

- **Auth-guard и tenant-scoping** — внутри handler'а: `requireAuth(event)` + `getWorkspaceForUserOrThrow(id, user.id)` в первых двух строках; нет общего middleware.
- **RBAC-guard** — `requireMinRole(actorRole, 'member' | 'admin' | ...)` внутри сервиса; роль приходит из `workspaceMembers` через `getWorkspaceForUserOrThrow`.
- **SSE pub/sub** — in-process EventEmitter в `server/utils/events.ts` (см. выше).
- **Analytics** — сервис-файл `server/services/analytics.service.ts` со SQL-запросами по `task_events`; нет ни отдельной папки `analytics/`, ни materialized views (см. [`docs/07-domain-model.md`](07-domain-model.md) → Target → materialized views, [`docs/10-analytics-design.md`](10-analytics-design.md)).
- **Background jobs** — нет, всё inline; `pg-boss` не установлен в `package.json`.
- **Feature flags** — нет, все фичи включены безусловно (см. [`docs/07-domain-model.md`](07-domain-model.md) → Target → feature_flags).
- **Plugins (logger, shutdown, jobs init)** — нет; никакого `pino`-init в коде, никакого worker-старта, никакого graceful-shutdown hook'а.

### Target: вынос middleware/jobs/ff в отдельные папки

> **Триггер ввода:** ≥ 30 endpoint'ов в `server/api/**` с одинаковым auth + tenant guard'ом в начале каждого handler'а (boilerplate становится дороже extraction'а), **или** появление первого async job'а (email send / webhook dispatch / aggregate refresh / Monte Carlo refresh), **или** первая необходимость частичного раскатывания фичи (canary / staged rollout — обычно совпадает со вторым платным клиентом).

```
server/
├── api/...
├── services/...
├── middleware/                # auth, tenant, rbac — вынос guard-логики из handler'ов
├── jobs/                      # pg-boss workers (analytics.recalculate, notifications.send, ...)
├── plugins/                   # Nitro plugins (logger init, pg-boss start, shutdown)
├── analytics/                 # выделение из services/ при разрастании MV-обёрток и aggregator'а
├── ff/                        # feature flags helper (см. 07-domain-model.md → Target → feature_flags)
└── utils/...
```

В Current триггер не выполнен ни по одному пункту: 44 endpoint'а с разными комбинациями guard'ов (часть только-auth, часть auth+tenant+min-role); зависимостей `pg-boss` / Object Storage / cron-job'ов нет — фоновых задач нет; флагов фич нет. Соответствующие триггеры также прописаны в [`docs/06-system-architecture.md`](06-system-architecture.md) (компонентный уровень) и [`docs/11-non-functional.md`](11-non-functional.md) → Target → middleware extraction.

---

## Пять вещей, которые нужно понимать

1. **HTTP handler (Nitro / H3).** Файл `server/api/workspaces/[id]/boards/[boardId]/tasks/index.post.ts` экспортирует `defineEventHandler(async event => ...)`. Файл-роутинг: путь файла = URL, метод (`.post`, `.get`) — из имени; `[id]` — динамический сегмент.
2. **Drizzle.** ORM на TypeScript. Schema в `server/db/schema/tasks.ts`. Запросы — `tx.select().from(tasks).where(eq(tasks.id, id))`. Никакого DSL, читается как SQL.
3. **Миграции (Drizzle Kit).** Меняешь schema → `pnpm db:generate` → создаётся SQL-файл в `drizzle/migrations/`. `pnpm db:migrate` применяет. RLS-политики добавлены отдельным SQL-файлом (`0003_rls_policies.sql`, `0004_rls_nullif_fix.sql`, `0006_sprints_rls.sql`).
4. **Sessions через nuxt-auth-utils.** При логине `setUserSession(event, { user: { id, email } })` ставит подписанный HTTP-only cookie. На запросах `getUserSession(event)` читает; `requireAuth(event)` — обёртка с throw 401.
5. **Tenant scoping через `withTenant`.** Любой запрос к tenant-scoped таблице (`boards`, `board_columns`, `tasks`, `task_events`, `sprints`, `sprint_tasks`) — внутри `withTenant(workspaceId, async (tx) => { ... })`. RLS-политики и FORCE ROW LEVEL SECURITY включены на 6 таблицах из 9: `boards`, `board_columns`, `tasks`, `task_events`, `sprints`, `sprint_tasks`. `users` — глобальная (не tenant-scoped). `workspaces` и `workspace_members` пока без RLS — известное отставание, см. [`docs/11-non-functional.md`](11-non-functional.md) → Target → RLS на `workspaces` и `workspace_members`.

---

## Библиотеки

### Current

Из реального `package.json`:

- `nuxt` (4.x) + `h3` (через nuxt) — HTTP-сервер.
- `drizzle-orm` + `drizzle-kit` — ORM и миграции.
- `postgres` (postgres-js) — Postgres driver.
- `nuxt-auth-utils` — session cookies (HTTP-only, signed). Дефолтный hasher — `scrypt`.
- `zod` — runtime-валидация request params/body внутри handler'ов.
- `pino` + `pino-pretty` — установлены в зависимостях, **но в коде не вызываются**: логирования сегодня нет (см. ниже).
- `vitest`, `@nuxt/test-utils`, `happy-dom` — тестовая инфраструктура.

### Target — добавки к стеку

> **Триггер ввода:** триггеры конкретных функций срабатывают по отдельности, не пакетом. Пакет ставится по факту первой реальной потребности.

- **`pg-boss`** — фоновые задачи на Postgres. Триггер: первый async job. См. [`docs/06-system-architecture.md`](06-system-architecture.md) → pg-boss workers.
- **`zod-to-openapi`** (`@asteasolutions/zod-to-openapi`) — генерация OpenAPI YAML из zod-схем. Триггер: см. ниже «API contract codegen».
- **`openapi-typescript`** — генерация TS-типов из OpenAPI YAML. Триггер: см. ниже.
- **`@testcontainers/postgresql`** — реальный Postgres в integration-тестах. Триггер: первый тест, упавший на расхождении `better-sqlite3`-mock'а с реальным Postgres (RLS, JSONB-операторы, `set_config`). Сегодня тестов с testcontainers нет.
- **`@sentry/node`**, **`prom-client`**, OpenTelemetry SDK — observability stack; см. [`docs/11-non-functional.md`](11-non-functional.md) → Target → error tracking / метрики / trace.

---

## Авторизация

### Current

- Хеширование паролей — `hashPassword()` / `verifyPassword()` из `nuxt-auth-utils`. По умолчанию — `scrypt` (не argon2id). Параметры (cost / iterations) — из библиотеки, не override'ятся.
- Сессии — подписанный HTTP-only cookie с `user.id` и `user.email`. Подпись через `NUXT_SESSION_PASSWORD` env. **Не JWT.**
- Helper для protected handler'ов: `await requireAuth(event)` в [`server/utils/auth.ts`](../server/utils/auth.ts) — возвращает `session.user` или кидает `UnauthorizedError` (401).
- Logout — `clearUserSession(event)` → cookie очищается. Серверной таблицы `sessions` нет — sliding-expire / global-revoke не реализованы.

### Target: argon2id + восстановление пароля + 2FA + SSO

> **Триггеры:** см. [`docs/11-non-functional.md`](11-non-functional.md) → Target → восстановление пароля / rate limiting / глобальная revoke / 2FA / SSO. Каждая фича вводится по своему триггеру; в этом документе только пометка «owned by 11-NFR».

---

## Пример handler'а

Реальный код [`server/api/workspaces/[id]/boards/[boardId]/tasks/index.post.ts`](../server/api/workspaces/%5Bid%5D/boards/%5BboardId%5D/tasks/index.post.ts):

```typescript
import { z } from 'zod'
import { createTask } from '../../../../../../services/tasks.service'
import { getWorkspaceForUserOrThrow } from '../../../../../../services/workspaces.service'
import { requireAuth } from '../../../../../../utils/auth'
import { toHttpError } from '../../../../../../utils/errors'

const ParamsSchema = z.object({ id: z.uuid(), boardId: z.uuid() })
const BodySchema = z.object({
  columnId: z.uuid(),
  title: z.string().trim().min(1).max(255),
  description: z.string().max(20_000).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  assigneeId: z.uuid().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  try {
    const user = await requireAuth(event)
    const { id, boardId } = await getValidatedRouterParams(event, ParamsSchema.parse)
    const body = await readValidatedBody(event, BodySchema.parse)
    const workspace = await getWorkspaceForUserOrThrow(id, user.id)

    const task = await createTask({
      workspaceId: id,
      boardId,
      ...body,
      actorId: user.id,
      actorRole: workspace.role,
    })
    return { task }
  } catch (err) {
    throw toHttpError(err)
  }
})
```

Три слоя: **handler** (auth + валидация + try/catch → toHttpError) → **service** (бизнес-логика, RBAC через `requireMinRole`, транзакция через `withTenant`, публикация события через `publishBoardEvent`) → **db** (Drizzle queries в той же service-функции). Нет промежуточных слоёв `repository`/`use-case`/`controller` — пока разговоров о них нет, не вводим.

---

## Обработка ошибок

### Current

Domain-классы в [`server/utils/errors.ts`](../server/utils/errors.ts):

```typescript
export class NotFoundError extends Error { readonly statusCode = 404 }
export class ForbiddenError extends Error { readonly statusCode = 403 }
export class ConflictError extends Error { readonly statusCode = 409 }
export class ValidationError extends Error { readonly statusCode = 422 }
export class UnauthorizedError extends Error { readonly statusCode = 401 }
```

Маппер `toHttpError(err)`:
- domain-класс → `createError({ statusCode, statusMessage })`;
- `ZodError` → 400 + `{ issues }` в теле (frontend показывает field-level ошибки);
- остальное — пропускает наружу (Nitro отдаст 500).

Использование — единый `try { ... } catch (err) { throw toHttpError(err) }` на handler. Внутри сервисов — только `throw` нужного domain-класса, без try/catch; импортов `createError` в сервисах нет.

### Target: structured error logging + correlation IDs

> **Триггер ввода:** первый деплой на prod-VM с реальными пользователями; **или** второй раз, когда пришлось «вспоминать что произошло» по 500-ке без stacktrace в централизованном лог-стриме.

Owned by [`docs/11-non-functional.md`](11-non-functional.md) → Target → error tracking (Sentry) / structured logging.

---

## API-контракт между frontend и backend

### Current

Codegen pipeline отсутствует. Frontend и backend не разделены через сгенерированные типы — frontend сейчас skeleton (см. [`docs/09-frontend-design.md`](09-frontend-design.md) → Current vs Target), реальных endpoint-вызовов из `app/` ещё нет. Валидация request/response — zod-схемы внутри handler'ов; типы экспортируются и импортируются вручную.

В `shared/types/` лежит единственный файл — [`shared/types/auth.d.ts`](../shared/types/auth.d.ts), расширяющий `nuxt-auth-utils` интерфейс `User`. Файла `shared/types/api.d.ts` нет; папки `openapi/` нет.

В `package.json` нет ни `zod-to-openapi`, ни `openapi-typescript`, ни npm-скриптов `pnpm openapi:generate` / `pnpm codegen`.

### Target: API contract codegen

> **Триггер ввода:** активная работа над frontend (≥ 5 endpoint-вызовов из `app/` к разным API-маршрутам); **или** первая бага типа «frontend ждал поле `assigneeId`, а backend начал отдавать `assignee_id`», обнаруженная только на runtime.

Цепочка:
1. Меняешь zod-схему в `server/api/...` (например, добавляешь поле в `BodySchema` для create-task).
2. `pnpm openapi:generate` → `zod-to-openapi` пересобирает `openapi/scrumban.yaml`.
3. `pnpm codegen` → `openapi-typescript` обновляет `shared/types/api.d.ts`.
4. TypeScript-компилятор сразу показывает frontend-местам, где типы изменились (compile-time fail вместо runtime).
5. (Опционально) `pnpm contract:test` — проверка реализации против spec через `schemathesis` CLI.

**Жёсткое правило:** frontend никогда не импортирует из `server/`. Граница — `openapi/scrumban.yaml` + сгенерированные TS-типы в `shared/types/api.d.ts`.

В Current ничего из этого не подключено — ни инструментов, ни скриптов, ни artifact'ов.

---

## SSE / events

### Current

Реализация — in-process pub/sub через `node:events`:

- [`server/utils/events.ts`](../server/utils/events.ts) экспортирует `publishBoardEvent` и `subscribeBoardEvents`, оперируя per-board каналом `board:<boardId>`.
- Сервисы (`tasks.service.ts`, `columns.service.ts`, ...) вызывают `publishBoardEvent({ type, workspaceId, boardId, payload })` **после** успешного `withTenant`-коммита.
- SSE-endpoint [`server/api/workspaces/[id]/boards/[boardId]/stream.get.ts`](../server/api/workspaces/%5Bid%5D/boards/%5BboardId%5D/stream.get.ts) использует H3 `createEventStream(event)`, подписывается через `subscribeBoardEvents`, шлёт heartbeat-комментарий каждые 25 с (chuyển default Caddy idle timeout 30 с), и `stream.onClosed(() => unsubscribe())` снимает listener при дисконнекте клиента или shutdown'е сервера.
- Single-instance only: при появлении второй реплики Nitro в bus`е будут события только от своего инстанса. Это явный комментарий внутри `events.ts`.

### Target: LISTEN/NOTIFY bridge для cross-node fan-out

> **Триггер ввода:** появление 2-й реплики Nitro (триггер совпадает с [`docs/06-system-architecture.md`](06-system-architecture.md) → LISTEN/NOTIFY bridge и [`docs/11-non-functional.md`](11-non-functional.md) → SSE scaling).

`publishBoardEvent` дополнительно публикует в Postgres-канал; параллельный listener в каждом инстансе re-emits в свой in-process bus. Sticky sessions для самого SSE-коннекшена — обязательное дополнение (балансер должен держать клиента на одной реплике).

---

## Event log (`task_events`)

### Current

Таблица `task_events` (см. [`docs/07-domain-model.md`](07-domain-model.md) → Current → `task_events`) — специализированный лог изменений задач: `task_created`, `task_moved` (с `from_column_id` / `to_column_id`), `task_updated`, `task_deleted`. Используется `analytics.service.ts` как источник всех flow-метрик (throughput, cycle time, CFD, Monte Carlo, Little's Law).

Сервисы пишут в `task_events` в той же транзакции, что и изменение `tasks`, через `withTenant` — атомарность гарантирована.

### Target: общая таблица `events` для других entity-типов

> **Триггер ввода:** появление ≥ 3 типов entities, для которых независимо нужен event-log (sprint_events, comment_events, attachment_events). Сегодня единственный event-source — задачи; специализация даёт типизацию `from_column_id` / `to_column_id` без `payload jsonb`-парсинга в SQL аналитики.

Триггер совпадает с [`docs/07-domain-model.md`](07-domain-model.md) → Target → events. Owned by 07.

---

## Analytics

### Current

Все аналитические запросы — live SQL по `task_events` через [`server/services/analytics.service.ts`](../server/services/analytics.service.ts):

- `computeThroughput` — `count(*)` по `date_trunc('day' | 'week', created_at)` с фильтром по типу `task_closed`.
- `computeCycleTime`, `computeCfd`, `computeMonteCarlo`, `computeWipRecommendations` — там же, аналогичный SQL-стиль.
- Min-data thresholds: при < 5 closed tasks процентильные поля возвращаются как `null` (правило «honesty over hype» из [`docs/10-analytics-design.md`](10-analytics-design.md)).
- RBAC: `requireMinRole(actorRole, 'viewer')` в начале каждой функции — все роли видят аналитику, но не анонимы.

Materialized views и `flow_daily`-агрегатов нет.

### Target: materialized views + `flow_daily` aggregates

> **Триггер ввода:** p95 latency `/api/.../analytics/*` > 500 мс при ≥ 100 закрытых задач/мес. Триггер совпадает с [`docs/06-system-architecture.md`](06-system-architecture.md) → Aggregator service и [`docs/07-domain-model.md`](07-domain-model.md) → Target → materialized views (`mv_cfd_last_90d`, `mv_throughput_weekly`, `mv_cycle_time_percentiles`).

Owned by 07 (определение MV) и 06 (схема Aggregator-сервиса). При выделении из `services/` в отдельный `server/analytics/` каталог — см. триггер «вынос middleware/jobs/ff» выше.

---

## Тесты

### Current

- vitest, `@nuxt/test-utils`, `happy-dom` стоят в `devDependencies`.
- `pnpm test` запускает vitest. Реального тестового покрытия пока минимально — основное покрытие появится с первыми регрессиями.
- `@testcontainers/postgresql` — **не установлен**; integration-тестов с реальным Postgres сегодня нет.

### Target: расширенная пирамида тестов

> **Триггер ввода:** первая регрессия, которую vitest без реального Postgres не поймал (например, RLS-баг или JSONB-оператор), **или** ≥ 3 фичи в одном sprint'е, где тесты с моком dB давали false-confidence.

- Unit (vitest) + Integration (vitest + testcontainers/postgresql).
- E2E API через `@nuxt/test-utils` (поднимает Nitro и бьёт по HTTP).
- **RLS guard test** — попытка cross-tenant доступа через `withTenant` с чужим workspace_id → 0 строк.
- Snapshot-тесты на analytics-результаты.
- Load-тест (k6) — перед защитой для главы о производительности.

---

## Logging / observability

### Current

- В коде сервера логирования нет: нет ни `console.log`, ни вызова `pino`. `pino` и `pino-pretty` — в `dependencies` / `devDependencies`, но не инстанциированы и не передаются как Nitro-плагин.
- Request IDs не присваиваются.
- Метрик не собирается.

### Target

> **Триггер ввода и детали** — owned by [`docs/11-non-functional.md`](11-non-functional.md) → Observability (structured logging / Sentry / Prometheus / OpenTelemetry).

Здесь — только pointer: backend по факту первого деплоя на prod-VM включает structured logging (pino через Nitro плагин с request-ID middleware), затем по триггерам — Sentry, Prometheus, OTEL.

---

## Эволюция: путь из Current в Target

Хронология срабатывания триггеров (наиболее вероятная):

1. **Активная работа над frontend** → подключаем `zod-to-openapi` + `openapi-typescript` codegen. Без этого ручной impedance mismatch очень быстро накопит баги.
2. **Первый async job** (вероятно — refresh Monte Carlo для team dashboard или email-нотификация) → `pg-boss` + `server/jobs/` + Nitro-плагин для старта worker'ов.
3. **Прод-деплой за публичным URL** → structured logging + request IDs (owned by 11-NFR).
4. **30+ endpoint'ов с одинаковым auth+tenant guard'ом** → выделяем `server/middleware/` (auth, tenant, rbac).
5. **p95 analytics > 500 мс при ≥ 100 closed tasks/мес** → Aggregator service + `flow_daily` + materialized views (owned by 06/07).
6. **Вторая реплика Nitro** → LISTEN/NOTIFY bridge для SSE + sticky sessions на балансере.
7. **Второй платный клиент с canary-требованием** → таблица `feature_flags` + `server/ff/` (owned by 07).

Сигналы «пора рефакторить» внутри Current:
- handler `> 20 строк` — выносим логику в service;
- service-файл `> 500 строк` — разбиваем по entity / use-case;
- одна и та же связка строк копируется по handler'ам — кандидат в utils или middleware.

---

## Связанные документы

- [`docs/06-system-architecture.md`](06-system-architecture.md) — компонентная диаграмма, триггеры pg-boss / LISTEN-NOTIFY / Aggregator.
- [`docs/07-domain-model.md`](07-domain-model.md) — схема БД, RLS-покрытие, Target-сущности (events, feature_flags, materialized views).
- [`docs/09-frontend-design.md`](09-frontend-design.md) — клиент (Nuxt SPA), Current skeleton vs Target.
- [`docs/10-analytics-design.md`](10-analytics-design.md) — формулы (CFD, Monte Carlo, Little's Law) и «honesty over hype».
- [`docs/11-non-functional.md`](11-non-functional.md) — auth / RBAC / RLS / observability — owned-секции.
- [`docs/12-deployment.md`](12-deployment.md) — Caddy, docker-compose, systemd, production-deploy details.
- [`docs/uml/01-use-case/roles-guide.md`](uml/01-use-case/roles-guide.md) — роли и required-role per endpoint.
- [`docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`](superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md) — pivot spec монорепы.
