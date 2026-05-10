# Диаграмма компонентов

Архитектура Scrumban-платформы в терминах программных компонентов и их взаимодействия (UML 2.5 component diagram).

> Исходник PlantUML: [`components.puml`](components.puml). Preview через PlantUML plugin в IDE.

## Обзор

Система разделена на **4 уровня** (tiers):

1. **Client tier** — Browser с Nuxt 4 SPA runtime.
2. **Edge tier** — Caddy reverse-proxy (TLS, routing, sticky sessions).
3. **Application tier** — Nuxt monorepo (Nitro server отдаёт и SPA static, и API в одном процессе).
4. **Data tier** — PostgreSQL (основная БД) и Object Storage (S3-совместимое).
5. **Внешние сервисы** — SMTP, Integration Bot, Git Platform.

## Компоненты Nitro server (детально)

### HTTP API (H3 router)
Точка входа для всех `/api/*` запросов. Файл-роутинг: `server/api/tasks/index.post.ts` обслуживает `POST /api/tasks`. Делегирует обработку цепочке middleware и дальше в сервисы.

### Middleware chain
Цепочка, через которую проходит каждый запрос (файлы в `server/middleware/`):
1. **Logging & Error hook** — pino structured logs + Nitro error handler.
2. **AuthN** — `getUserSession(event)` читает подписанный cookie, извлекает `userId` в `event.context.user`.
3. **Tenant** — извлекает `workspaceId` из URL, проверяет членство пользователя, выставляет `SET LOCAL app.workspace_id = $1` в транзакции для RLS.
4. **RBAC** — проверяет разрешение для конкретного действия (через `requireRole(event, 'admin')`).

### Domain Services
«Толстые» сервисы с бизнес-логикой. Один сервис на функциональную область:
- **Workspace Service** — workspace lifecycle, membership, roles, invitations.
- **Project & Board Service** — проекты, доски, колонки, WIP-лимиты.
- **Task Service** — CRUD задач, перемещение, комментарии, вложения.
- **Sprint Service** — спринты, планирование, velocity.
- **Auth Service** — регистрация, вход, восстановление пароля, сессии.

Handlers тонкие — только парсинг/форматирование; вся логика в сервисах.

### Analytics Engine
Отдельный модуль (`server/analytics/`) с математикой. Не обращается к HTTP, только к Storage.
- **CFD builder** — строит Cumulative Flow Diagram из `flow_daily`.
- **Cycle time / Percentiles** — вычисление перцентилей (`p50/p85/p95`) из `cycle_time_samples`.
- **Monte Carlo Simulator** — ≥1000 симуляций throughput-распределения для прогноза спринта.
- **Little's Law Recommender** — формула `WIP = throughput × cycle_time` с объяснением.
- **Aggregator** — инкрементальное обновление `flow_daily` и `cycle_time_samples` при получении события.

### Event Bus
- **In-proc Publisher** — синхронная рассылка событий подписчикам внутри процесса.
- **LISTEN/NOTIFY Bridge** — при scale-out (2+ реплики) транслирует события между репликами через PostgreSQL `pg_notify`.

### SSE Hub
- **Subscriber Registry** — пул активных SSE-соединений (чанки потоков, группировка по `workspace_id`).
- **Broadcaster** — отправка обновлений всем подписчикам workspace'а.

### Background Worker (pg-boss)
Обрабатывает фоновые задачи. Worker'ы регистрируются в Nitro plugin при старте процесса:
- **Webhook Dispatcher** — доставка webhook'ов во внешние системы.
- **Email Sender** — отправка через SMTP.
- **Aggregate Recompute** — пересчёт агрегатов, если нужен batch (fallback к trigger'ам).
- **MC Refresh** — пересчёт Monte Carlo для активных спринтов.

### Feature Flags
- Таблица `feature_flags` в БД + helper `await ff.isEnabled(workspaceId, 'feature_name')`.
- Используется сервисами для gated rollout.

### Storage (Drizzle ORM)
- Типобезопасный доступ к PostgreSQL через Drizzle (typeof inference из schema-определений).
- Управление транзакциями, postgres-js connection pool.

## Ключевые интерфейсы и потоки

### Browser → Caddy → Nitro
1. Пользователь открывает `https://scrumban.ru` → Caddy (HTTPS).
2. Caddy маршрутизирует **всё** на один upstream — Nitro процесс (порт 3000):
   - `/api/*` → H3 router → handler в `server/api/`.
   - `/api/*/stream` → SSE handler с sticky-cookie (чтобы соединение держалось на одной реплике).
   - всё остальное → SPA static (Nuxt build).

### Event flow внутри Nitro
1. Сервис выполняет бизнес-операцию (например, `tasksService.move()`).
2. После успеха: `eventBus.publish(event)`.
3. In-proc Publisher параллельно вызывает:
   - `sseHub.broadcast(event)` → рассылка подписчикам в этом процессе через H3 `createEventStream()`.
   - `boss.send('jobName', payload)` → ставит задачу для webhook/email через pg-boss.
   - `analyticsAggregator.on(event)` → инкрементальное обновление агрегатов.
4. LISTEN/NOTIFY Bridge (при scale-out): публикует событие в Postgres-канал, другие реплики подхватывают через LISTEN.

### Данные на S3
- Вложения к задачам: через **presigned URL** — клиент загружает/скачивает напрямую в/из Object Storage, минуя backend.
- Бэкапы БД: `pg_dump` по расписанию → upload в bucket.

### Входящий webhook
Git Platform (GitFlic/GitVerse) шлёт webhook при push:
1. `POST /api/v1/webhooks/gitflic` → HTTP API.
2. Middleware (специальный для webhook'ов: verify signature, не требует сессии).
3. Service парсит commit, находит упомянутые задачи, линкует.
4. Event опубликован → SSE + уведомления в чат.

## Архитектурные принципы, видные из диаграммы

### 1. Модульный монолит, не микросервисы
Все backend-компоненты — один Node-процесс (Nitro). Разделение — на уровне модулей `server/services/*` с дисциплиной импортов (проверяется ESLint `no-restricted-imports`). Это даёт простоту деплоя (один образ, один реестр) при сохранении внутренней модульности.

### 2. Единая точка входа — Caddy
TLS, routing, sticky sessions для SSE решаются на одном слое. Dev и prod окружения отличаются только конфигурацией — нулевая дельта.

### 3. Postgres как универсальный backbone
- Данные (domain tables с RLS).
- События (append-only `events`).
- Агрегаты + materialized views.
- Очередь фоновых задач (`pg-boss`).
- Канал межрепликной коммуникации (`LISTEN/NOTIFY`).

Redis, RabbitMQ, Kafka — сознательно отсутствуют до момента, когда нагрузка реально потребует.

### 4. Object Storage через S3-совместимый интерфейс
В коде — один интерфейс (`ObjectStore`), реализации заменяемы:
- Production SaaS: Yandex Object Storage.
- Dev / on-prem: MinIO.
Никакого vendor lock-in'а.

### 5. SSE вместо WebSocket
Проще: обычное HTTP keep-alive соединение, сервер держит stream через H3 `createEventStream()` и пушит события. Для MVP хватает (нужен только server→client direction, client→server идёт через обычные POST). Sticky sessions решают проблему множественных реплик.

### 6. Один процесс — frontend + backend
Nitro отдаёт и `/api/*` (HTTP handlers), и SPA static (build Nuxt). Никакого отдельного BFF — `server/api/` и есть «backend для frontend». TypeScript end-to-end, общие типы через `shared/types/`. Это и есть выгода Nuxt monorepo.

## Границы (что НЕ показано)

- **Тестовая инфраструктура** (testcontainers, mock storage) — не часть production компонентов.
- **CI/CD pipeline** — не компонент системы runtime; см. [`../../12-deployment.md`](../../12-deployment.md).
- **Observability (Sentry, OpenTelemetry)** — опущено для ясности; относится к cross-cutting concerns. В Target-state — отдельный диаграммный слой.
- **Платёжные шлюзы (ЮKassa/CloudPayments)** — LATER, не в MVP.
- **Identity Provider для SSO** (Yandex ID, SAML) — LATER.

## Связь с другими артефактами

- **System architecture:** [`../../06-system-architecture.md`](../../06-system-architecture.md) — текстовое описание тех же компонентов.
- **Backend design:** [`../../08-backend-design.md`](../../08-backend-design.md) — структура Nitro-модулей, дисциплина импортов.
- **Sequence diagrams:** [`../06-sequence/`](../06-sequence/) — взаимодействие компонентов во времени для ключевых сценариев.
