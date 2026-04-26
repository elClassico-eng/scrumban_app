# Диаграмма компонентов

Архитектура Scrumban-платформы в терминах программных компонентов и их взаимодействия (UML 2.5 component diagram).

![Component Diagram](components.svg)

> Исходник PlantUML: [`components.puml`](components.puml). Регенерация: `plantuml -tsvg components.puml`.

## Обзор

Система разделена на **4 уровня** (tiers):

1. **Client tier** — Browser с Nuxt SPA runtime.
2. **Edge tier** — Caddy reverse-proxy (TLS, routing, sticky sessions).
3. **Application tier** — Nuxt (SPA static + BFF) и Go backend (монолитный сервис).
4. **Data tier** — PostgreSQL (основная БД) и Object Storage (S3-совместимое).
5. **Внешние сервисы** — SMTP, Integration Bot, Git Platform.

## Компоненты Go backend (детально)

### HTTP API (echo)
Точка входа для всех `/api/*` запросов. Определяет роутинг (`POST /api/v1/tasks`, ...) и делегирует обработку цепочке middleware и дальше в сервисы.

### Middleware chain
Цепочка, через которую проходит каждый запрос:
1. **Logging & Recovery** — structured logs через slog + recover от panic.
2. **AuthN (cookies)** — проверяет session cookie, извлекает `user_id`.
3. **Tenant** — извлекает `workspace_id` из URL, проверяет членство пользователя, выставляет `SET LOCAL app.workspace_id = $1` в транзакции для RLS.
4. **RBAC** — проверяет разрешение для конкретного действия (через `RequireRole` / `RequirePermission`).

### Domain Services
«Толстые» сервисы с бизнес-логикой. Один сервис на функциональную область:
- **Workspace Service** — workspace lifecycle, membership, roles, invitations.
- **Project & Board Service** — проекты, доски, колонки, WIP-лимиты.
- **Task Service** — CRUD задач, перемещение, комментарии, вложения.
- **Sprint Service** — спринты, планирование, velocity.
- **Auth Service** — регистрация, вход, восстановление пароля, сессии.

Handlers тонкие — только парсинг/форматирование; вся логика в сервисах.

### Analytics Engine
Отдельный пакет с математикой. Не обращается к HTTP, только к Storage.
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

### Background Worker (river)
Обрабатывает фоновые задачи:
- **Webhook Dispatcher** — доставка webhook'ов во внешние системы.
- **Email Sender** — отправка через SMTP.
- **Aggregate Recompute** — пересчёт агрегатов, если нужен batch (fallback к trigger'ам).
- **MC Refresh** — пересчёт Monte Carlo для активных спринтов.

### Feature Flags
- Таблица `feature_flags` в БД + helper `ff.IsEnabled(ctx, "feature_name")`.
- Используется сервисами для gated rollout.

### Storage (pgx + sqlc)
- Типобезопасный доступ к PostgreSQL через sqlc-генерируемый код.
- Управление транзакциями, connection pool.

## Ключевые интерфейсы и потоки

### Browser → Caddy → Go/Nuxt
1. Пользователь открывает `https://scrumban.ru` → Caddy (HTTPS).
2. Caddy маршрутизирует:
   - `/api/*` → Go HTTP API (порт 8080).
   - `/api/*/stream` → Go с sticky-cookie (чтобы SSE-соединение держалось на одной реплике).
   - остальное → Nuxt static bundle (порт 3000) + Nuxt Server routes через `/bff/*`.

### Event flow внутри Go
1. Сервис выполняет бизнес-операцию (например, `TasksService.Move`).
2. После успеха: `EventBus.Publish(event)`.
3. In-proc Publisher параллельно вызывает:
   - `SSEHub.Broadcast(event)` → рассылка подписчикам в этом процессе.
   - `Worker.Enqueue(...)` → ставит задачу для webhook/email.
   - `Analytics.Aggregator.On(event)` → инкрементальное обновление агрегатов.
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
Все Go-компоненты — один бинарь. Разделение — на уровне пакетов с дисциплиной импортов (проверяется `go-arch-lint`). Это даёт простоту деплоя (один образ, один реестр) при сохранении внутренней модульности.

### 2. Единая точка входа — Caddy
TLS, routing, sticky sessions для SSE решаются на одном слое. Dev и prod окружения отличаются только конфигурацией — нулевая дельта.

### 3. Postgres как универсальный backbone
- Данные (domain tables с RLS).
- События (append-only `events`).
- Агрегаты + materialized views.
- Очередь фоновых задач (`river`).
- Канал межрепликной коммуникации (`LISTEN/NOTIFY`).

Redis, RabbitMQ, Kafka — сознательно отсутствуют до момента, когда нагрузка реально потребует.

### 4. Object Storage через S3-совместимый интерфейс
В коде — один интерфейс (`ObjectStore`), реализации заменяемы:
- Production SaaS: Yandex Object Storage.
- Dev / on-prem: MinIO.
Никакого vendor lock-in'а.

### 5. SSE вместо WebSocket
Проще: обычное HTTP keep-alive соединение, сервер держит stream и пушит события. Для MVP хватает (нужен только server→client direction, client→server идёт через обычные POST). Sticky sessions решают проблему множественных реплик.

### 6. BFF-паттерн с Nuxt Server
Nuxt Server routes (Nitro) — тонкий BFF слой: агрегирует запросы, адаптирует payload'ы, проксирует к Go. Это даёт frontend'у возможность делать бизнес-специфичные оптимизации (объединение нескольких API-вызовов в один) без изменения backend'а.

## Границы (что НЕ показано)

- **Тестовая инфраструктура** (testcontainers, mock storage) — не часть production компонентов.
- **CI/CD pipeline** — не компонент системы runtime; см. [`../../12-deployment.md`](../../12-deployment.md).
- **Observability (Sentry, OpenTelemetry)** — опущено для ясности; относится к cross-cutting concerns. В Target-state — отдельный диаграммный слой.
- **Платёжные шлюзы (ЮKassa/CloudPayments)** — LATER, не в MVP.
- **Identity Provider для SSO** (Yandex ID, SAML) — LATER.

## Связь с другими артефактами

- **System architecture:** [`../../06-system-architecture.md`](../../06-system-architecture.md) — текстовое описание тех же компонентов.
- **Backend design:** [`../../08-backend-design.md`](../../08-backend-design.md) — структура Go-пакетов, дисциплина импортов.
- **Deployment diagram:** [`../05-deployment/`](../05-deployment/) — на каких физических узлах живут эти компоненты.
- **Sequence diagrams:** [`../06-sequence/`](../06-sequence/) — взаимодействие компонентов во времени для ключевых сценариев.
