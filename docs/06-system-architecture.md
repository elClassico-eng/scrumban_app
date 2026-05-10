# 06 — System Architecture

## Обзор

Scrumban-платформа — Nuxt 4 monorepo: SPA-frontend в `app/` и Nitro-backend (Node.js) в `server/`. Работает в двух режимах развёртывания (SaaS multi-tenant и on-premise single-tenant) из одного кода и docker-compose-файла.

## Компоненты системы (Current)

Диаграмма ниже отражает то, что реально есть в репозитории на момент написания: один Nitro-процесс, in-process event bus на `node:events`, прямой доступ к Nitro без reverse-proxy (Caddyfile в репо отсутствует), отсутствие pg-boss и LISTEN/NOTIFY в коде, единственный Postgres с RLS на 6 таблицах. Всё, что было раньше нарисовано на этой диаграмме (pg-boss workers, LISTEN/NOTIFY, sticky-sessions в Caddy, Aggregator), вынесено в раздел Target ниже с измеримыми триггерами ввода.

```
┌─────────────────── Browser (Nuxt 4 SPA) ───────────────────┐
│   Vue 3 • Pinia • ECharts • SSE-клиент • TypeScript        │
└────────────────────────┬───────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼───────────────────────────────────┐
│   Reverse-proxy + TLS — планируется Caddy (Phase 5)        │
│   В Current прямой доступ к Nitro (dev / single VM)        │
└────────────────────────┬───────────────────────────────────┘
                         │
                ┌────────▼───────────────────────┐
                │   Nitro Server (1 реплика)     │
                │   - HTTP API (H3 router)       │
                │   - in-handler auth + tenant   │
                │   - domain services            │
                │   - analytics engine (live SQL)│
                │   - in-process EventEmitter    │
                │   - SSE hub                    │
                │   - SPA static (Nuxt build)    │
                └──┬─────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   PostgreSQL 16     │
        │   - tenant data     │
        │   - RLS на 6 табл.  │
        │   - task_events log │
        └─────────────────────┘
```

### Target architecture (Phase 4+)

Все добавления к Current сопровождаются триггерами ввода — измеримыми условиями нагрузки или бизнеса. Ни один из перечисленных компонентов не появляется «на всякий случай»: если триггер не сработал, компонент не вводится.

````
┌── Caddy ────┐
│ TLS         │  ← Триггер: первый продакшн-деплой за публичным URL
│ sticky cks  │  ← Триггер sticky sessions: появление 2-й Nitro-реплики
└─────────────┘

Nitro Server (N реплик):
  + pg-boss workers          ← Триггер: первый async job (email send / webhook / aggregate refresh / MC refresh)
  + LISTEN/NOTIFY bridge     ← Триггер: появление 2-й реплики (cross-node SSE fan-out)
  + Aggregator service       ← Триггер: p95 latency `/api/.../analytics/*` > 500 мс при ≥ 100 закрытых задач/мес

PostgreSQL:
  + flow_daily aggregates    ← Триггер: вместе с Aggregator service
  + materialized views       ← Триггер: p95 analytics > 500 мс
  + pg-boss job queue        ← Триггер: вместе с pg-boss workers
  + LISTEN/NOTIFY channel    ← Триггер: вместе с LISTEN/NOTIFY bridge

Object Storage (S3-совместимый / MinIO):
  + attachments              ← Триггер: реализация `task_attachments` entity (см. 07-domain-model.md)
  + backups                  ← Триггер: первый продакшн-клиент с реальными данными
````

## Ключевые архитектурные решения

### 1. Модульный монолит на Node.js (Nitro)
**Почему не микросервисы:** для соло-разработчика микросервисы означают удвоение/утроение работы (несколько CI/CD, несколько деплоев, сложная локальная разработка). Модульный монолит даёт ту же структуру — модули `server/services/*` с чёткими границами — без оверхеда.

**Почему Nitro, не отдельный backend:** TypeScript end-to-end (один язык на frontend и backend), общие типы через `shared/types/`, OpenAPI codegen без межязыковых границ. Solo-разработчик с TS-фоном пишет всё в одном стеке.

**Горизонтальное масштабирование** достигается репликами одного Node-процесса за балансером. Для 99% реальных нагрузок этого достаточно.

### 2. Reverse-proxy (Caddy) — Target (Phase 5)

В Current Caddy в репозитории **не настроен** (Caddyfile отсутствует), Nitro слушает напрямую. Это нормально для dev и для single-VM деплоя за внешним балансером облачного провайдера. Caddy вводится в Target — план остаётся прежним:

- Нулевой config для HTTPS (автоматический Let's Encrypt). **Триггер ввода:** первый продакшн-деплой за публичным URL без внешнего балансера.
- Одинаковый Caddyfile на dev и prod.
- Sticky sessions для SSE — **Target**, включается при появлении 2-й реплики Nitro. В Current single-replica, sticky cookie не нужны: SSE-клиент по определению попадает в тот же процесс.
- Единый домен для пользователя; разделение на backend/frontend невидимо.

### 3. PostgreSQL как единый источник правды
- Хранит tenant-данные и `task_events`-лог.
- RLS (Row-Level Security) обеспечивает изоляцию tenant'ов — FORCE ROW LEVEL SECURITY включён с первого дня на **6 из 9 таблиц** (`boards`, `board_columns`, `tasks`, `task_events`, `sprints`, `sprint_tasks`). `users` исключена намеренно (глобальная, не tenant-scoped), `workspaces` и `workspace_members` пока без RLS — известное отставание, см. backlog в `COMPACT.md`.
- Никаких Redis / RabbitMQ / Kafka до тех пор, пока нагрузка не оправдает.

В **Target** Postgres дополнительно берёт на себя:

- **pg-boss как очередь фоновых задач.** В репо пакет не установлен. **Триггер ввода:** появление первого асинхронного job (отправка email, dispatch webhook, refresh aggregate, refresh Monte Carlo). До первого такого случая очередь не нужна — все эффекты выполняются inline в HTTP-обработчике.
- **LISTEN/NOTIFY для cross-node SSE fan-out.** В Current `server/utils/events.ts` — это `node:events` `EventEmitter`; LISTEN/NOTIFY в коде нет. **Триггер ввода:** появление 2-й реплики Nitro (без неё in-process bus накрывает 100% подписчиков). Комментарий в `server/utils/events.ts` уже фиксирует это решение.

### 4. Object Storage через S3-совместимый интерфейс — Target

В Current Object Storage не используется: сущность `task_attachments` отнесена в Target (см. `07-domain-model.md`), а резервные копии Postgres делаются средствами hosting'а / отдельного скрипта вне MVP. План на Target:

- В SaaS: Yandex Object Storage.
- В on-prem: MinIO (или любой S3-compat).
- В коде: один интерфейс, реализации взаимозаменяемы.
- **Триггер ввода attachments:** реализация `task_attachments` (см. `07-domain-model.md`).
- **Триггер ввода backups:** первый продакшн-клиент с реальными данными.

### 5. SSE (Server-Sent Events) вместо WebSocket
- Проще: обычный HTTP keep-alive, никаких специальных серверов.
- Достаточно: однонаправленная передача обновлений доски.
- В Current — single-replica, in-process bus покрывает 100% подписчиков.
- В Target — масштабируется через Postgres LISTEN/NOTIFY между инстансами. **Триггер:** появление 2-й реплики Nitro.
- WebSocket — только в LATER, если потребуется двусторонний real-time (live cursors, collaborative editing).

### 6. Feature flags — Target

В Current таблицы `feature_flags` нет; helper `ff.IsEnabled()` не реализован. Решение оставлено в Target вместе с остальными «инфра-сущностями второй очереди» (`audit_log`, `events`, materialized views — см. `07-domain-model.md`). План при вводе:

- Таблица `feature_flags` + `ff.IsEnabled(ctx, name)` helper.
- Любая новая фича за флагом.
- **Триггер ввода:** первая необходимость частичного раскатывания фичи (canary / staged rollout) — обычно совпадает с появлением второго платного клиента (триггер совпадает с `07-domain-model.md`).

## Потоки данных

### Обычный HTTP-запрос (Current)
1. Browser → HTTPS → Nitro (прямой доступ; Caddy появится в Target).
2. Один Nitro-процесс отдаёт и `/api/*`, и SPA static.
3. Auth + tenant guard выполняются in-handler (см. `server/utils/auth.ts`, `server/utils/db.ts`): logging → authN (session cookie) → **tenant context (SET app.workspace_id для RLS)** → RBAC. Это in-handler-вызовы, а не глобальные middleware-цепочки в `server/middleware/`.
4. Handler (`server/api/...`) → service (`server/services/...`) → Drizzle query (RLS действует на уровне БД) → response.
5. Если изменение домена попадает на доску: после успешной транзакции вызывается `publishBoardEvent()` → in-process EventEmitter.

### Event-driven побочные эффекты (Current)
1. Событие (например, `task.moved`) попадает в in-process bus (`server/utils/events.ts`).
2. Подписчики Current:
   - **SSE hub** → рассылает активным клиентам board'а через H3 `createEventStream()`.
   - **`task_events` write** выполняется inline в самом сервисе (не через bus) — это специализированный лог именно по задачам, см. `07-domain-model.md`.
3. Других подписчиков (webhook dispatch, email send, analytics aggregator) в Current нет — все аналитические показатели считаются live-SQL по `task_events` и `tasks` без фоновых aggregator'ов.

### Event-driven побочные эффекты (Target, Phase 4+)
1. **pg-boss workers** добавляются как подписчик на bus / прямое API. **Триггер ввода:** первый асинхронный job (email send / webhook dispatch / aggregate refresh / MC refresh).
2. **Aggregator service** обновляет `flow_daily` инкрементально. **Триггер ввода:** p95 latency `/api/.../analytics/*` > 500 мс при ≥ 100 закрытых задач/мес (порог матчит `07-domain-model.md` и `10-analytics-design.md`).
3. **Cross-node fan-out через Postgres LISTEN/NOTIFY.** **Триггер ввода:** появление 2-й реплики Nitro.

### Background jobs (Target)
В Current очередь не используется (`pg-boss` не в `package.json`). В Target:
- Сервисы публикуют задачи в очередь (`pg-boss` — Postgres-based, без Redis).
- Воркер (тот же Nitro-процесс или отдельный) разгребает очередь.
- Типичные задачи: webhook dispatch, email send, aggregate recompute, MC-refresh.
- **Триггер ввода:** первый async job (см. выше). До этого момента inline-исполнения хватает.

### SSE поток (Current)
1. Клиент (Nuxt) открывает `GET /api/v1/boards/{id}/stream` с `Accept: text/event-stream`.
2. Запрос приходит на единственную реплику Nitro.
3. H3 `createEventStream()` добавляет клиента в in-process hub (`subscribeBoardEvents()`).
4. При событии в этом же процессе → broadcast внутри процесса всем подписчикам board'а.

### SSE поток (Target, при ≥ 2 репликах)
1. Caddy проставляет sticky cookie и маршрутизирует SSE-соединение на одну и ту же реплику.
2. При событии на другой реплике уведомление приходит через LISTEN/NOTIFY → локальный bus → broadcast подписчикам.
3. **Триггер ввода обоих механизмов:** появление 2-й реплики Nitro. До этого ни sticky sessions, ни LISTEN/NOTIFY не нужны.

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

### Current (что реально в репозитории)
- Nitro server — единая реплика; один Node-процесс отдаёт и API, и SPA static.
- Postgres 16 — отдельный контейнер (в репозитории нет `docker-compose.prod.yml`; для dev Postgres поднимается локально/через testcontainers).
- Reverse-proxy и TLS отсутствуют (Caddyfile в репо нет) — Nitro слушает напрямую.
- Events: in-process bus на `node:events` `EventEmitter` (`server/utils/events.ts`). LISTEN/NOTIFY в коде нет.
- SSE: in-memory hub через H3 `createEventStream()`, single-replica.
- Background jobs: **отсутствуют**. `pg-boss` не установлен; все эффекты выполняются inline в HTTP-обработчике.
- Аналитика: live-SQL поверх `task_events` и `tasks`, без `flow_daily` и без materialized views.
- Object Storage: не используется (нет `task_attachments` сущности — см. `07-domain-model.md`).
- Feature flags: не реализованы — попадают в Target (см. `07-domain-model.md`).
- RLS: FORCE ROW LEVEL SECURITY включён с первого дня на 6 из 9 таблиц (`boards`, `board_columns`, `tasks`, `task_events`, `sprints`, `sprint_tasks`). `users` глобальна (намеренно без RLS); `workspaces` и `workspace_members` — известное отставание, см. backlog в `COMPACT.md`.

### Target (Phase 4+, по триггерам)

Каждый пункт — измеримое условие ввода, а не «когда понадобится»:

- **Caddy + TLS.** Триггер: первый продакшн-деплой за публичным URL без внешнего балансера.
- **2+ реплики Nitro за балансером.** Триггер: p95 latency API > 500 мс при текущих нагрузках, **или** > 100 одновременных пользователей на инстанс (см. таблицу нефункциональных характеристик ниже).
- **Sticky sessions для SSE.** Триггер: появление 2-й реплики Nitro.
- **LISTEN/NOTIFY bridge для cross-node SSE fan-out.** Триггер: появление 2-й реплики Nitro.
- **pg-boss + worker-процесс.** Триггер: первый асинхронный job (email send / webhook dispatch / aggregate refresh / MC refresh).
- **Aggregator service + `flow_daily` + materialized views.** Триггер: p95 latency `/api/.../analytics/*` > 500 мс при ≥ 100 закрытых задач/мес. Триггер совпадает с Target-разделом `07-domain-model.md` (там же определены сами таблицы и MV).
- **Object Storage attachments.** Триггер: реализация `task_attachments` entity (см. триггеры в `07-domain-model.md`).
- **Object Storage backups.** Триггер: первый продакшн-клиент с реальными данными.
- **Managed PostgreSQL** (Yandex Managed PostgreSQL или отдельная VM с репликой). Триггер: ≥ 500 активных workspace'ов **или** размер БД > 50 ГБ.
- **CDN для статичных ассетов.** Триггер: SPA-bundle latency p95 > 1 с у удалённых пользователей.

Observability-стек (Sentry / OpenTelemetry / централизованные pino-логи) и связанные NFR живут в `11-non-functional.md`.

### Evolution

- При 100+ активных команд: выделить БД на отдельную VM.
- При 500+ команд: Managed PostgreSQL + 2 реплики бэкенда (синхронно с триггером Sticky sessions / LISTEN/NOTIFY выше).
- При недостаточной throughput LISTEN/NOTIFY: Redis Pub/Sub как замена.
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