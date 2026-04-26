# 06 — System Architecture

## Обзор

Scrumban-платформа — модульный монолит на Go с SPA-фронтендом на Nuxt 3, работающая в двух режимах развёртывания (SaaS multi-tenant и on-premise single-tenant) из одного кода и docker-compose-файла.

## Компоненты системы

```
┌─────────────────── Browser (Nuxt SPA) ────────────────────┐
│   Vue 3 • Pinia • ECharts • SSE-клиент • TypeScript       │
└────────────────────────┬──────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼──────────────────────────────────┐
│              Caddy (TLS, reverse-proxy)                    │
│    /api/* → Go backend        everything else → Nuxt       │
└────┬──────────────────────────────────┬───────────────────┘
     │ static + /bff/*                   │ /api/*
┌────▼─────────────────┐        ┌────────▼──────────────────┐
│   Nuxt server (BFF)  │        │    Go Backend (1+ реплик) │
│  - аггрегация        │        │  - HTTP API (echo)         │
│  - адаптация         │        │  - auth middleware         │
│  - proxy to Go       │        │  - tenant middleware (RLS) │
└──────────────────────┘        │  - domain services         │
                                │  - analytics engine        │
                                │  - event publisher         │
                                │  - SSE hub                 │
                                │  - background worker       │
                                └──┬──────────────────┬──────┘
                                   │                  │
                        ┌──────────▼───────┐    ┌─────▼────────┐
                        │   PostgreSQL 16   │    │ Object Store  │
                        │ - tenant data     │    │ (S3-compat)   │
                        │ - events          │    │ - attachments │
                        │ - aggregates      │    │ - backups     │
                        │ - job queue(river)│    └──────────────┘
                        │ - LISTEN/NOTIFY   │
                        │ - RLS policies    │
                        └───────────────────┘
```

## Ключевые архитектурные решения

### 1. Модульный монолит на Go
**Почему не микросервисы:** для соло-разработчика микросервисы означают удвоение/утроение работы (несколько CI/CD, несколько деплоев, сложная локальная разработка). Модульный монолит даёт ту же структуру — доменные пакеты с чёткими границами — без оверхеда.

**Горизонтальное масштабирование** достигается репликами одного бинаря за балансером. Для 99% реальных нагрузок этого достаточно.

### 2. Reverse-proxy (Caddy) как единая точка входа
- Нулевой config для HTTPS (автоматический Let's Encrypt).
- Одинаковый Caddyfile на dev и prod.
- Sticky sessions для SSE (критично при scale-out).
- Единый домен для пользователя; разделение на backend/frontend невидимо.

### 3. PostgreSQL как единый источник правды
- Хранит данные и фоновые задачи (river).
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
2. Caddy → Go backend (если `/api/*`).
3. Middleware chain: logging → recovery → authN (cookie) → **tenant (SET app.workspace_id для RLS)** → RBAC.
4. Handler → service → storage (RLS действует) → response.
5. Если изменение домена: event публикуется в in-process event bus.

### Event-driven побочные эффекты
1. Событие (например, `task_moved`) попадает в bus.
2. Подписчики:
   - `sse.Hub` → рассылает активным SSE-клиентам workspace'а.
   - `jobs.Enqueue` → фоновая отправка webhook'ов / email'ов.
   - `analytics.Aggregator` → incremental update `flow_daily` агрегата.
3. Между репликами Go-инстанса: событие транслируется через Postgres `LISTEN/NOTIFY`.

### Background jobs
- Подписчики публикуют задачи в очередь (river на Postgres).
- Воркер (тот же бинарь или отдельный) разгребает очередь.
- Типичные задачи: webhook dispatch, email send, aggregate recompute, ML research jobs (LATER).

### SSE поток
1. Клиент (Nuxt) открывает `GET /api/v1/workspaces/{id}/stream` с Accept: text/event-stream.
2. Caddy проставляет sticky cookie, маршрутизирует на одну и ту же реплику Go.
3. Go добавляет клиента в in-process hub.
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
- Go backend — единая реплика на одной VM.
- Postgres — в Docker на той же VM.
- Object Storage — Yandex Object Storage (или MinIO локально для dev).
- Caddy — HTTPS + routing.
- Events: in-process bus (без LISTEN/NOTIFY пока одна реплика).
- SSE: in-memory hub.
- Background jobs: river в Postgres.
- Feature flags: env + БД.
- RLS: включён с первого дня на всех tenant-scoped таблицах.

### Target
- Go backend — 2+ реплики за балансером.
- Postgres — managed (Yandex Managed PostgreSQL) или отдельная VM с репликой.
- LISTEN/NOTIFY для cross-node event propagation.
- Object Storage — с CDN для статичных ассетов.
- Observability: Sentry + OpenTelemetry + structured logs в центральное хранилище.
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
- [`08-backend-design.md`](08-backend-design.md) — детали Go-бэкенда
- [`09-frontend-design.md`](09-frontend-design.md) — детали Nuxt
- [`11-non-functional.md`](11-non-functional.md) — auth, RBAC, RLS детально
- [`12-deployment.md`](12-deployment.md) — deployment и инфраструктура