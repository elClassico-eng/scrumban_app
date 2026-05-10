# Диаграмма компонентов — Current (Phase 1-3 MVP)

Архитектура Scrumban-платформы в терминах программных компонентов и их взаимодействия (UML 2.5 component diagram). Диаграмма отражает то, что **реально есть в репозитории** на момент написания, а не Target-план.

> Исходник PlantUML: [`components.puml`](components.puml). Preview через PlantUML plugin в IDE.

> Текстовая (ASCII) версия той же архитектуры и измеримые триггеры ввода Target-компонентов — в [`../../06-system-architecture.md`](../../06-system-architecture.md). Этот файл — UML-зеркало того раздела.

## Обзор

Система состоит из **3 уровней** (tiers):

1. **Browser tier** — Nuxt 4 SPA (в Current — skeleton; полноценный UI в Phase 4).
2. **Application tier** — один Nitro-процесс (Node.js): HTTP API, бизнес-логика, аналитика, in-process EventBus, SSE hub.
3. **Data tier** — PostgreSQL 16 с RLS на 6 таблицах из 9 и append-only `task_events`-логом.

Никакого Caddy, pg-boss, LISTEN/NOTIFY, Aggregator'а, Object Storage и внешних интеграций в Current нет — всё это Target. См. блок «Не реализовано в Current» в самой диаграмме и Target-секции в [`../../06-system-architecture.md`](../../06-system-architecture.md).

## Компоненты Nitro server (детально)

### HTTP API (H3 router)
Точка входа для всех `/api/*` запросов (~44 endpoints на момент Phase 3). Файл-роутинг H3: например, `server/api/workspaces/[workspaceId]/tasks/index.post.ts` обслуживает `POST /api/workspaces/:workspaceId/tasks`. Handler — тонкий: парсинг + zod-валидация + вызов сервиса + форматирование ответа.

### Auth + Tenant guards (in-handler)
Папки `server/middleware/` нет; вместо неё в начале каждого защищённого handler'а вызываются guard-функции:

1. **Auth** — `getUserSession(event)` через `nuxt-auth-utils` читает подписанный cookie, извлекает `userId`. Если сессии нет — `throw createError({ statusCode: 401 })`.
2. **Tenant** — `withTenant(event, workspaceId, fn)` проверяет членство пользователя в workspace и оборачивает SQL-блок в транзакцию с `SELECT set_config('app.workspace_id', $1, true)` для активации RLS-политик.

Это **Current**-форма (guard-clause в handler'ах). Перенос в `server/middleware/*` — Target-задача после стабилизации списка endpoint'ов.

### Domain Services
«Толстые» сервисы с бизнес-логикой в `server/services/*`. На момент Phase 3:

- **workspaces** — workspace lifecycle, membership, инвайты.
- **boards** — доски, колонки, WIP-лимиты.
- **tasks** — CRUD задач, drag-n-drop перемещение, запись `task_events`.
- **sprints** — спринты, state machine (`planning → active → closed`).
- **analytics** — CFD, throughput, cycle time, Monte Carlo, Little's Law.
- **auth** — регистрация, вход, сессии.

Handlers тонкие — только парсинг/форматирование; вся логика в сервисах.

### RBAC helpers
`server/utils/rbac.ts` — `requireRole(event, workspaceId, ...allowedRoles)`. 5 ролей: `owner`, `admin`, `scrum_master`, `member`, `viewer` (см. `workspace_member_role` enum в [`server/db/schema/workspaces.ts`](../../../server/db/schema/workspaces.ts)). Проверка делается в handler'ах после auth+tenant, до вызова сервиса.

### Analytics engine
Отдельный модуль (`server/services/analytics/`) с математикой. Не обращается к HTTP, только к Storage:

- **CFD builder** — строит Cumulative Flow Diagram **прямым SQL-агрегатом** по `task_events` (без `flow_daily` — это Target).
- **Throughput / Cycle time** — перцентили `p50/p85/p95` живым SQL по `task_events`.
- **Monte Carlo Simulator** — ≥1000 симуляций throughput-распределения для прогноза спринта.
- **Little's Law Recommender** — формула `WIP = throughput × cycle_time` с объяснением.

Кэшей и материализованных представлений в Current нет: каждый запрос — fresh SQL по `task_events`. Aggregator + `flow_daily` + materialized views — Target, **триггер ввода**: p95 latency `/api/.../analytics/*` > 500 мс при ≥ 100 закрытых задач/мес (см. 06).

### EventBus (in-process)
`server/utils/events.ts` — Node.js `EventEmitter` (3 экземпляра / события на класс). Сервисы публикуют доменные события (`task.created`, `task.moved`, …) синхронно; SSE hub подписывается и транслирует их клиентам.

В коде уже стоит комментарий, фиксирующий решение: при появлении 2-й реплики `publishBoardEvent()` дополнительно эмитит через `pg LISTEN/NOTIFY` — это **Target**, триггер ввода — появление 2-й Nitro-реплики.

### SSE hub
H3 `createEventStream()` держит keep-alive соединения, сгруппированные по `workspaceId`. При `eventBus.emit(event)` все активные подписчики этого workspace'а получают событие через `event-stream`. Никаких реестров и брокеров — функциональность встроена в H3.

### Domain errors + toHttpError
`server/utils/errors.ts` — sentinel-классы доменных ошибок (`NotFoundError`, `ForbiddenError`, `ValidationError`, …) + единая функция `toHttpError(err)` для преобразования в `H3Error` со статусом и кодом. Применяется в handler'ах через `try/catch` или Nitro error hook.

## Ключевые потоки данных

### Browser → Nitro
1. Пользователь открывает SPA (в Current — skeleton-страница). Nitro отдаёт SPA static (Nuxt build) и `/api/*`.
2. SPA делает `fetch('/api/...')` или подписывается на `EventSource('/api/.../stream')`.
3. В Current прямой доступ к Nitro (Caddyfile в репо отсутствует). Reverse-proxy (Caddy + TLS) — Target, **триггер ввода**: первый prod-deploy за публичным URL без внешнего балансера.

### Event flow внутри Nitro
1. Сервис выполняет бизнес-операцию (например, `tasksService.move()`).
2. Записывает `task_events` (append-only) в той же транзакции.
3. После commit'а: `eventBus.emit('task.moved', payload)`.
4. SSE hub получает событие синхронно и транслирует подписчикам этого workspace'а.

Никакой очереди, retry'ев, DLQ — это **Target** через pg-boss workers, **триггер ввода**: первый async job (email send / webhook dispatch / aggregate refresh / MC refresh).

### RLS-изоляция tenant'ов
Каждая SQL-операция, чувствительная к tenant'у, оборачивается в `withTenant(workspaceId, fn)`:

```ts
await db.transaction(async (tx) => {
  await tx.execute(sql`SELECT set_config('app.workspace_id', ${workspaceId}, true)`)
  return await fn(tx)
})
```

После этого RLS-политики на 6 таблицах автоматически фильтруют выборки. `users` исключена намеренно (глобальная сущность), `workspaces` и `workspace_members` пока без RLS — известное отставание (см. backlog в `COMPACT.md`).

## Архитектурные принципы, видные из диаграммы

### 1. Модульный монолит, не микросервисы
Все backend-компоненты — один Node-процесс (Nitro). Разделение — на уровне модулей `server/services/*`. Это даёт простоту деплоя (один образ, один реестр) при сохранении внутренней модульности.

### 2. Postgres как backbone (Current — данные + лог)
В Current Postgres хранит:

- Domain tables с RLS (изоляция tenant'ов).
- `task_events` append-only лог (источник правды для аналитики).

В Target Postgres дополнительно берёт на себя `pg-boss` (job queue), `LISTEN/NOTIFY` (cross-node SSE fan-out), `flow_daily` агрегаты, materialized views — каждый со своим триггером ввода.

### 3. SSE вместо WebSocket
Однонаправленный поток `server → client` через H3 `createEventStream()`. Client → server идёт через обычные POST. Sticky sessions не нужны в Current (single replica); Target включает их в Caddy при появлении 2-й реплики.

### 4. Один процесс — frontend + backend
Nitro отдаёт и `/api/*`, и SPA static (build Nuxt). TypeScript end-to-end, общие типы через `shared/types/`. Это и есть выгода Nuxt monorepo.

## Границы (что НЕ показано)

- **Тестовая инфраструктура** (testcontainers, mock storage) — не часть production runtime.
- **CI/CD pipeline** — не компонент системы runtime; см. [`../../12-deployment.md`](../../12-deployment.md).
- **Observability (Sentry, OpenTelemetry)** — Target. В Current — `console.log` (pino установлен в `package.json`, но не подключён).
- **Платёжные шлюзы (ЮKassa/CloudPayments)** — LATER.
- **Identity Provider для SSO** (Yandex ID, SAML) — LATER.

## Связь с другими артефактами

- **System architecture (текстовый канон):** [`../../06-system-architecture.md`](../../06-system-architecture.md) — ASCII-диаграмма Current и полный список Target-компонентов с триггерами ввода.
- **Backend design:** [`../../08-backend-design.md`](../../08-backend-design.md) — структура Nitro-модулей, дисциплина импортов.
- **Sequence diagrams:** [`../06-sequence/`](../06-sequence/) — взаимодействие компонентов во времени для ключевых сценариев.
