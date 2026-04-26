# 06 — System Architecture

## Обзор

Scrumban-платформа — Nuxt 4 monorepo: SPA-frontend в `app/` и Nitro-backend (Node.js) в `server/`. Работает в двух режимах развёртывания (SaaS multi-tenant и on-premise single-tenant) из одного кода и docker-compose-файла.

## Компоненты системы

```
┌─────────────────── Browser (Nuxt 4 SPA) ──────────────────┐
│   Vue 3 • Pinia • ECharts • SSE-клиент • TypeScript       │
└────────────────────────┬──────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼──────────────────────────────────┐
│              Caddy (TLS, reverse-proxy)                    │
│    /api/* + static → один Nitro-процесс (Nuxt monorepo)    │
└────────────────────────┬──────────────────────────────────┘
                         │
                ┌────────▼──────────────────────┐
                │    Nitro Server (1+ реплик)    │
                │  - HTTP API (H3 router)        │
                │  - auth middleware             │
                │  - tenant middleware (RLS)     │
                │  - domain services             │
                │  - analytics engine            │
                │  - event publisher             │
                │  - SSE hub                     │
                │  - pg-boss workers             │
                │  - SPA static (Nuxt build)     │
                └──┬──────────────────────┬──────┘
                   │                      │
        ┌──────────▼──────────┐    ┌──────▼────────┐
        │   PostgreSQL 16      │    │ Object Store  │
        │ - tenant data        │    │ (S3-compat)   │
        │ - events             │    │ - attachments │
        │ - aggregates         │    │ - backups     │
        │ - pg-boss job queue  │    └───────────────┘
        │ - LISTEN/NOTIFY      │
        │ - RLS policies       │
        └──────────────────────┘
```

## Ключевые архитектурные решения

### 1. Модульный монолит на Node.js (Nitro)
**Почему не микросервисы:** для соло-разработчика микросервисы означают удвоение/утроение работы (несколько CI/CD, несколько деплоев, сложная локальная разработка). Модульный монолит даёт ту же структуру — модули `server/services/*` с чёткими границами — без оверхеда.

**Почему Nitro, не отдельный backend:** TypeScript end-to-end (один язык на frontend и backend), общие типы через `shared/types/`, OpenAPI codegen без межязыковых границ. Solo-разработчик с TS-фоном пишет всё в одном стеке.

**Горизонтальное масштабирование** достигается репликами одного Node-процесса за балансером. Для 99% реальных нагрузок этого достаточно.

### 2. Reverse-proxy (Caddy) как единая точка входа
- Нулевой config для HTTPS (автоматический Let's Encrypt).
- Одинаковый Caddyfile на dev и prod.
- Sticky sessions для SSE (критично при scale-out).
- Единый домен для пользователя; разделение на backend/frontend невидимо.

### 3. PostgreSQL как единый источник правды
- Хранит данные и фоновые задачи (pg-boss — Postgres-очередь).
- LISTEN/NOTIFY используется для SSE fan-out при scale-out.
- RLS (Row-Level Security) обеспечивает изоляцию tenant'ов.
- Никаких Redis / RabbitMQ / Kafka до тех пор, пока нагрузка не оправдает.

### 4. Object Storage через S3-совместимый интерфейс
- В SaaS: Yandex Object Storage.
- В on-prem: MinIO (или любой S3-compat).
- В коде: один интерфейс, реализации взаимозаменяемы.

### 5. SSE (Server-Sent Events) вместо WebSocket
- Проще: обычный HTTP keep-alive, никаких специальных серверов.
- Достаточно: однонаправленная передача обновлений доски.
- Масштабируется через Postgres LISTEN/NOTIFY между инстансами.
- WebSocket — только в LATER, если потребуется двусторонний real-time (live cursors, collaborative editing).

### 6. Feature flags с первого дня
- Таблица `feature_flags` + `ff.IsEnabled(ctx, name)` helper.
- Любая новая фича за флагом.
- На демо сломалось — выключил за 5 секунд без деплоя.

## Потоки данных

### Обычный HTTP-запрос
1. Browser → HTTPS → Caddy.
2. Caddy → Nitro (один процесс отдаёт и `/api/*`, и SPA static).
3. Middleware chain в `server/middleware/`: logging → authN (session cookie) → **tenant (SET app.workspace_id для RLS)** → RBAC.
4. Handler (`server/api/...`) → service (`server/services/...`) → Drizzle query (RLS действует на уровне БД) → response.
5. Если изменение домена: event публикуется в in-process event bus или сразу через `pg NOTIFY`.

### Event-driven побочные эффекты
1. Событие (например, `task_moved`) попадает в in-process bus.
2. Подписчики:
   - SSE hub → рассылает активным клиентам workspace'а через `H3 createEventStream()`.
   - `boss.send('jobName', payload)` → фоновая отправка webhook'ов / email'ов.
   - Analytics aggregator → incremental update `flow_daily` агрегата.
3. Между репликами Nitro: событие транслируется через Postgres `LISTEN/NOTIFY`.

### Background jobs
- Сервисы публикуют задачи в очередь (`pg-boss` — Postgres-based).
- Воркер (тот же Nitro-процесс или отдельный) разгребает очередь.
- Типичные задачи: webhook dispatch, email send, aggregate recompute, ML research jobs (LATER).

### SSE поток
1. Клиент (Nuxt) открывает `GET /api/v1/workspaces/{id}/stream` с Accept: text/event-stream.
2. Caddy проставляет sticky cookie, маршрутизирует на одну и ту же реплику Nitro.
3. H3 `createEventStream(event)` добавляет клиента в in-process hub.
4. При событии в текущем инстансе → broadcast внутри процесса.
5. При событии в другом инстансе → через LISTEN/NOTIFY приходит уведомление → broadcast.

## Режимы развёртывания

### SaaS (multi-tenant)
- Один образ, один деплой.
- Множество Workspace'ов в одной БД.
- Изоляция — RLS + композитные индексы.
- Hosting: Yandex Cloud VM (или VK Cloud / Selectel).

### On-premise (single-tenant)
- Клиент запускает `docker-compose.yml` у себя.
- Один Workspace по умолчанию (или включает multi-tenant режим для своей компании).
- Код идентичен SaaS-версии; поведение определяется env-переменными и feature flags.

## Dual-track

### Current (MVP)
- Nitro server — единая реплика на одной VM (один Node-процесс отдаёт и API, и SPA static).
- Postgres — в Docker на той же VM.
- Object Storage — Yandex Object Storage (или MinIO локально для dev).
- Caddy — HTTPS + routing.
- Events: in-process bus (без LISTEN/NOTIFY пока одна реплика).
- SSE: in-memory hub через H3 `createEventStream()`.
- Background jobs: pg-boss в Postgres (в том же Node-процессе).
- Feature flags: env + БД.
- RLS: включён с первого дня на всех tenant-scoped таблицах.

### Target
- Nitro — 2+ реплики за балансером.
- Postgres — managed (Yandex Managed PostgreSQL) или отдельная VM с репликой.
- LISTEN/NOTIFY для cross-node event propagation.
- Object Storage — с CDN для статичных ассетов.
- pg-boss — отдельный worker-процесс (тот же кодбейс).
- Observability: Sentry + OpenTelemetry + structured logs (pino) в центральное хранилище.
- Backups автоматические, restore регулярно тестируется.

### Evolution
- При 100+ активных команд: выделить БД на отдельную VM.
- При 500+ команд: Managed PostgreSQL, 2 реплики бэкенда.
- При необходимости: Redis Pub/Sub как замена LISTEN/NOTIFY.
- При тяжёлой аналитике: вынести analytics-workers в отдельный процесс.
- При необходимости: K8s (Managed Kubernetes в Yandex Cloud).

## Нефункциональные характеристики

| Свойство | MVP | Target |
|----------|-----|--------|
| Доступность (uptime) | best-effort | 99.5% |
| Время отклика API (p95) | <500ms | <200ms |
| Concurrent users per instance | <100 | <1000 |
| Время запуска из dump'а БД | <15 минут | <5 минут |
| Recovery Time Objective | 4 часа | 1 час |
| Recovery Point Objective | 24 часа | 1 час |

## Связанные документы
- [`07-domain-model.md`](07-domain-model.md) — модель данных
- [`08-backend-design.md`](08-backend-design.md) — детали Nitro-бэкенда
- [`09-frontend-design.md`](09-frontend-design.md) — детали Nuxt
- [`11-non-functional.md`](11-non-functional.md) — auth, RBAC, RLS детально
- [`12-deployment.md`](12-deployment.md) — deployment и инфраструктура