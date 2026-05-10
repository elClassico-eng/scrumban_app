# 07 — Domain Model

## Структура документа

- [Current (Phase 1-3 MVP)](#current-phase-1-3-mvp) — 9 реализованных таблиц.
- [Target (Phase 4+)](#target-phase-4) — 11 entities и 3 materialized view, обоснованно отложенные с триггерами эволюции.

---

## Current (Phase 1-3 MVP)

Все перечисленные ниже таблицы реально определены в [`server/db/schema/`](../server/db/schema/) (Drizzle ORM, TypeScript). RLS-политики и FORCE ROW LEVEL SECURITY включены через SQL-миграции в [`drizzle/migrations/`](../drizzle/migrations/) на **6 таблицах из 9**: `boards`, `board_columns`, `tasks`, `task_events` (в `0003_rls_policies.sql`, с правкой `0004_rls_nullif_fix.sql`), `sprints`, `sprint_tasks` (в `0006_sprints_rls.sql`). Используется двухролевая Postgres-схема: `scrumban` (миграции, минует RLS) и `scrumban_app` (рантайм, FORCE RLS).

Из 9 таблиц без RLS: `users` (глобальная, не tenant-scoped — намеренно), `workspaces` и `workspace_members` (могли бы получить RLS-политику, но пока не получили — это **известное отставание**, выписано в backlog кода: добавить RLS на эти две таблицы + покрыть RLS-тестами).

Универсальные правила Current:

- Все tenant-scoped таблицы содержат `workspace_id uuid NOT NULL` с FK `ON DELETE CASCADE` на `workspaces.id`.
- `workspace_id` дублируется на дочерних таблицах (board_columns, tasks, task_events, sprint_tasks) — это позволяет RLS-политикам делать плоский `WHERE workspace_id = current_setting(...)` без JOIN'ов. Сервис-слой проверяет согласованность при INSERT.
- Все id — UUID v4 через `defaultRandom()` (Postgres `gen_random_uuid()`). Не v7: для текущего масштаба сортируемость по времени не нужна, переход — Target.
- Все timestamps — `timestamptz` в UTC; отображение в локали — задача frontend'а.
- Soft delete пока не используется; удаление — каскадное через FK.

### `users` — учётная запись

```text
id                 uuid PK, defaultRandom()
email              varchar(255) NOT NULL UNIQUE
password_hash      varchar(255) NOT NULL                -- scrypt через nuxt-auth-utils hashPassword()
created_at         timestamptz NOT NULL DEFAULT now()
updated_at         timestamptz NOT NULL DEFAULT now()
```

Глобальная учётная запись (не tenant-scoped). `email` уникален на уровне БД; lower-casing — задача сервис-слоя. Хеш пароля — **scrypt** (встроен в Node, дефолт nuxt-auth-utils); argon2id опционален при установке `@node-rs/argon2`. См. [`server/db/schema/users.ts`](../server/db/schema/users.ts).

### `workspaces` — корень тенанта

```text
id                 uuid PK, defaultRandom()
name               varchar(255) NOT NULL
slug               varchar(64)  NOT NULL UNIQUE         -- глобально уникален
created_at         timestamptz NOT NULL DEFAULT now()
updated_at         timestamptz NOT NULL DEFAULT now()
```

См. [`server/db/schema/workspaces.ts`](../server/db/schema/workspaces.ts).

**Quirks:**
- `slug` имеет **глобальный** UNIQUE (не per-tenant): два независимых заказчика не смогут оба создать `acme`. Известное ограничение, зафиксировано в `docs/audit-2026-05-10-issues.md` раздел 7. Решение — Target (либо namespacing slug'ов, либо переход на короткие коды).
- Поле `owner_id` отсутствует — владелец вычисляется как член `workspace_members` с `role = 'owner'`.
- Никаких `plan`, `settings jsonb`, `archived_at` — биллинг и настройки не реализованы.

### `workspace_members` — членство пользователей в workspace (M:N)

```text
workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
user_id            uuid NOT NULL REFERENCES users(id)      ON DELETE CASCADE
role               workspace_member_role NOT NULL
created_at         timestamptz NOT NULL DEFAULT now()
PRIMARY KEY (workspace_id, user_id)
```

Enum `workspace_member_role` имеет **5 значений**: `viewer`, `member`, `scrum_master`, `admin`, `owner`. Иерархия и матрица прав документирована в [`docs/uml/01-use-case/roles-guide.md`](uml/01-use-case/roles-guide.md). Наследование («admin может всё, что member») реализовано на уровне RBAC-middleware приложения, не в БД.

См. [`server/db/schema/workspaces.ts`](../server/db/schema/workspaces.ts).

### `boards` — доска внутри workspace

```text
id                 uuid PK, defaultRandom()
workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
name               varchar(255) NOT NULL
slug               varchar(64)  NOT NULL                -- уникален в пределах workspace (UNIQUE INDEX по (workspace_id, slug))
created_at         timestamptz NOT NULL DEFAULT now()
updated_at         timestamptz NOT NULL DEFAULT now()
```

`workspace → board` напрямую: промежуточный `projects` сейчас отсутствует. Нет `type` (`scrumban`/`scrum`/`kanban`) — методология определяется конфигурацией колонок и наличием/отсутствием активного спринта, а не статическим полем.

См. [`server/db/schema/boards.ts`](../server/db/schema/boards.ts).

### `board_columns` — колонки доски

```text
id                 uuid PK, defaultRandom()
workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
board_id           uuid NOT NULL REFERENCES boards(id)     ON DELETE CASCADE
name               varchar(255) NOT NULL
position           integer NOT NULL                     -- UNIQUE INDEX по (board_id, position)
wip_limit          integer                              -- nullable: null = без лимита
column_role        column_role NOT NULL
created_at         timestamptz NOT NULL DEFAULT now()
```

Enum `column_role` имеет **5 значений**: `backlog`, `in_progress`, `review`, `done`, `archived`. Семантика отделена от пользовательского `name` — команда может переименовать «In Progress» в «Doing», а аналитика всё равно поймёт колонку через `column_role='in_progress'`.

Поля `is_terminal` и `wip_strict` отсутствуют: «терминальность» определяется через `column_role IN ('done', 'archived')`, а сила WIP-лимита — конфигурацией сервис-слоя (на момент Phase 1-3 лимит soft, проверка на move).

См. [`server/db/schema/boards.ts`](../server/db/schema/boards.ts).

### `tasks` — задача (центральная сущность)

```text
id                 uuid PK, defaultRandom()
workspace_id       uuid NOT NULL REFERENCES workspaces(id)    ON DELETE CASCADE
board_id           uuid NOT NULL REFERENCES boards(id)        ON DELETE CASCADE
column_id          uuid NOT NULL REFERENCES board_columns(id) ON DELETE RESTRICT
title              varchar(255) NOT NULL
description        text NOT NULL DEFAULT ''
assignee_id        uuid REFERENCES users(id) ON DELETE SET NULL
priority           task_priority NOT NULL DEFAULT 'medium'
position           integer NOT NULL                     -- сортировка внутри (board_id, column_id)
closed_at          timestamptz                          -- проставляется при входе в column_role='done'
reopened_count     integer NOT NULL DEFAULT 0
created_at         timestamptz NOT NULL DEFAULT now()
updated_at         timestamptz NOT NULL DEFAULT now()
```

Enum `task_priority` — `low`, `medium`, `high` (3 значения, **не** `low/normal/high/urgent`).

`column_id` — `ON DELETE RESTRICT`: колонку с задачами нельзя удалить, сервис обязан сначала переместить или архивировать задачи. Это сознательная защита от тихой потери данных.

`assignee_id` — `ON DELETE SET NULL`: при удалении пользователя задачи остаются, просто без исполнителя.

Связь со спринтом — через join-таблицу `sprint_tasks`, не через колонку `sprint_id` на задаче. Колонок `project_id`, `short_id` (формат «SCB-123»), `type` (`story/bug/task/epic`), `story_points`, `estimate_hours`, `reporter_id` нет — все они отнесены в Target.

См. [`server/db/schema/tasks.ts`](../server/db/schema/tasks.ts).

### `task_events` — append-only журнал движений задач

```text
id                 uuid PK, defaultRandom()
workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
task_id            uuid NOT NULL REFERENCES tasks(id)      ON DELETE CASCADE
event_type         task_event_type NOT NULL
from_column_id     uuid                                 -- nullable, не FK (см. Quirks); пустой для task_created
to_column_id       uuid                                 -- nullable, не FK (см. Quirks); пустой для task_archived
actor_id           uuid REFERENCES users(id) ON DELETE SET NULL
payload            jsonb NOT NULL DEFAULT '{}'
created_at         timestamptz NOT NULL DEFAULT now()
```

Enum `task_event_type` — `task_created`, `task_moved`, `task_closed`, `task_reopened`, `task_assigned`, `task_updated`, `task_archived` (7 значений). Это **специализированный** журнал именно по задачам, **не** универсальный `events` с `entity_type/entity_id`. См. секцию Target про `events` ниже — это сознательное архитектурное решение, а не недоделка.

`from_column_id` / `to_column_id` — типизированные `uuid`-колонки **без FK-ограничения** на `board_columns` (см. Quirks). Не поля внутри `payload jsonb` — типизация вытащена наружу для индексации и аналитики без JSON-парсинга.

Индексы:
- `(workspace_id)` — для RLS.
- `(task_id)` — лента истории конкретной задачи.
- `(workspace_id, created_at)` — workhorse для CFD / Monte Carlo: time-ordered scan по тенанту.

**Quirks:**
- `task_id` — `ON DELETE CASCADE`. Удаление задачи стирает её историю. Известное ограничение (зафиксировано в `docs/audit-2026-05-10-issues.md` раздел 7); в Target — либо `ON DELETE SET NULL` с сохранением `payload.task_snapshot`, либо `RESTRICT` с soft-delete на самой задаче.
- `from_column_id` / `to_column_id` — `uuid` без FK на `board_columns`. Сделано осознанно: при удалении колонки исторические события должны выживать (column-id остаётся «висячим» указателем для аналитики). Trade-off: невозможно через FK гарантировать, что значение указывает на реально существовавшую колонку — корректность отслеживается в сервис-слое (`server/services/tasks.service.ts`).

См. [`server/db/schema/tasks.ts`](../server/db/schema/tasks.ts).

### `sprints` — итерация работы

```text
id                 uuid PK, defaultRandom()
workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
board_id           uuid NOT NULL REFERENCES boards(id)     ON DELETE CASCADE
name               varchar(255) NOT NULL
goal               text NOT NULL DEFAULT ''
state              sprint_state NOT NULL DEFAULT 'planned'
planned_start_at   timestamptz
planned_end_at     timestamptz
started_at         timestamptz
ended_at           timestamptz
created_at         timestamptz NOT NULL DEFAULT now()
updated_at         timestamptz NOT NULL DEFAULT now()
```

Enum `sprint_state` — `planned`, `active`, `closed` (3 значения).

Стейт-машина: `planned → active` (endpoint `start`, проставляет `started_at`); `active → closed` (endpoint `close`, проставляет `ended_at`); `planned → closed` (отмена ни разу не запущенного спринта). Источник истины по длительности — `started_at` / `ended_at`, а не `planned_*`. Поля `closed_at` нет — используется `ended_at`.

**Партиальный UNIQUE INDEX** `sprints_one_active_per_board_idx` по `(board_id) WHERE state = 'active'` — на доске может быть не более одного активного спринта одновременно. Enforced на уровне БД.

Поля `project_id`, `created_by` отсутствуют — отнесены в Target (`projects`, `audit_log`).

См. [`server/db/schema/sprints.ts`](../server/db/schema/sprints.ts).

### `sprint_tasks` — M:N между спринтами и задачами

```text
sprint_id          uuid NOT NULL REFERENCES sprints(id)    ON DELETE CASCADE
task_id            uuid NOT NULL REFERENCES tasks(id)      ON DELETE CASCADE
workspace_id       uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE
added_at           timestamptz NOT NULL DEFAULT now()
PRIMARY KEY (sprint_id, task_id)
```

Задача может попадать в несколько спринтов (carry-over между итерациями), но обычно живёт в одном. Composite PK предотвращает дубликаты. См. [`server/db/schema/sprints.ts`](../server/db/schema/sprints.ts).

### Связи (Current)

```
users ──┐
        │ (M:N через workspace_members, 5 ролей)
        ▼
workspaces ──┐
             ├─► boards ──► board_columns
             │      │
             │      └─► tasks ──► task_events
             │              │
             └─► sprints ◄──┴──► sprint_tasks
                  (1 active per board enforced)
```

- `users ↔ workspaces` — M:N через `workspace_members` (роль на каждое членство).
- `workspaces → boards → board_columns` — иерархия workspace → board → column.
- `boards → tasks` — задачи живут на доске; их состояние определяется колонкой (`tasks.column_id`), отдельного `status` нет.
- `tasks → task_events` — append-only history; от движений между колонками выводится вся flow-аналитика.
- `boards → sprints` — каждый спринт принадлежит одной доске; `sprint_tasks` связывает M:N со задачами доски.

ER-диаграмма Current: [`docs/uml/03-er/database.puml`](uml/03-er/database.puml) (синхронизация с реализацией — отдельная задача в `docs/code-sync-2026-05-10`).

---

## Target (Phase 4+)

Сущности и оптимизации, обоснованно отложенные. Каждая описана с триггером ввода. Триггер — измеримое условие нагрузки или бизнеса, при котором имеет смысл вводить сущность.

### `projects` — контейнер досок и спринтов

> **Status:** не реализовано в Phase 1-3 MVP.
> **Триггер ввода:** ≥ 3 активных досок в одном workspace одновременно (например, разделение по командам / продуктовым линиям), **или** ≥ 1 user-request на группировку и cross-board view. Сегодня workspace → board напрямую достаточно для ранних команд, использующих 1–2 доски — типичная нагрузка MVP.

Ключевые поля: `id`, `workspace_id`, `name`, `key` (короткий префикс типа `SCB` для будущих task-short-id), `description`, `archived_at`. Связи: `workspace → projects → boards/sprints`.

### `task_comments` — комментарии к задачам с историей изменений

> **Status:** не реализовано в Phase 1-3 MVP.
> **Триггер ввода:** ≥ 5 активных пользователей в одном workspace, у которых пересекаются назначения по задачам (≥ 30% задач имеют ≥ 2 разных assignee/follower за rolling 7 дней), **или** первый прямой запрос пользователя «как обсудить задачу с коллегой внутри тулзы». Сегодня обсуждения выносят в Pachca/Slack — это нормально для команды до 5 человек, но даёт цену переключения контекста при росте.

Ключевые поля: `id`, `workspace_id`, `task_id`, `author_id`, `body` (markdown), `created_at`, `updated_at`, `deleted_at` (soft delete для истории редактирований). Связь: `task ←─ task_comments`.

### `task_attachments` — файловые вложения задач

> **Status:** не реализовано в Phase 1-3 MVP.
> **Precondition:** Object Storage в проде (S3-совместимый — Yandex Object Storage / MinIO).
> **Триггер ввода:** ≥ 2 клиента отдельно запросили attachments как блокер adoption'а, **или** обнаружен паттерн «скриншоты багов в комментариях» (после реализации `task_comments`) у ≥ 30% задач — продукт сам показывает потребность.

Ключевые поля: `id`, `workspace_id`, `task_id`, `uploaded_by`, `object_key` (путь в bucket'e), `filename`, `size_bytes`, `content_type`. Связь: `task ←─ task_attachments`. Без рабочего Object Storage введение бессмысленно — таблица будет ссылаться в никуда.

### `task_tags` — M:N теги задач

> **Status:** не реализовано в Phase 1-3 MVP.
> **Триггер ввода:** команда удерживает ≥ 50 активных задач одновременно и теряется в навигации без cross-cutting классификации.

Ключевые поля: `task_id`, `tag` (varchar). Composite PK `(task_id, tag)`. Связь: `task ←─ task_tags`. До этого порога фильтрации по assignee и колонке достаточно.

### `invitations` — magic-link приглашения по email

> **Status:** не реализовано в Phase 1-3 MVP. Создание членства идёт прямым добавлением через админский endpoint.
> **Триггер ввода:** первый публичный регистр / появление ≥ 2 одновременных команд (до этого можно создавать аккаунты вручную).

Ключевые поля: `id`, `workspace_id`, `email`, `role`, `token_hash`, `expires_at`, `invited_by`, `accepted_at`, partial UNIQUE по `(workspace_id, email) WHERE accepted_at IS NULL`. Связь: `workspace ←─ invitations`.

### `sessions` (server-side хранилище) — рассмотрена, отвергнута для Current

> **Status:** в Current используется stateless signed cookie через nuxt-auth-utils (без session-таблицы в БД). **Не планируется к замене на серверное хранилище без явного триггера.**
>
> **Триггер пересмотра:** первая необходимость глобального revoke (пользователь утерял устройство, админ инвалидирует все сессии без ожидания TTL) или multi-device session listing.

Это сознательная архитектурная развилка. Stateless cookie даёт zero-cost на чтение (никаких DB-round-trip'ов в auth-middleware) и ноль состояния на сервере. Цена — нельзя отозвать конкретную сессию досрочно (только дождаться TTL). Введение `sessions`-таблицы (поля: `id`, `user_id`, `token_hash UNIQUE`, `expires_at`, `user_agent`, `ip`, `revoked_at`) меняет этот трейд-офф в обмен на возможность revoke.

### `feature_flags` — глобальные / per-workspace флаги фич

> **Status:** не реализовано в Phase 1-3 MVP.
> **Триггер ввода:** первая необходимость частичного раскатывания фичи (canary / staged rollout) — обычно совпадает с появлением второго платного клиента.

Ключевые поля: `name PK`, `enabled_globally bool`, `allowed_workspaces uuid[]`, `description`, `created_at`. До второго клиента «фича либо есть, либо нет» — флагирование добавляет сложность без выгоды.

### `audit_log` — отдельный аудит-лог

> **Status:** не реализовано в Phase 1-3 MVP. Текущий журнал — `task_events`, ограничен задачами.
> **Триггер ввода:** первый Enterprise-клиент с compliance-требованиями (retention 7 лет, экспорт по запросу регулятора, immutability-гарантии).

Ключевые поля: `id`, `workspace_id`, `actor_id`, `action`, `entity_type`, `entity_id`, `occurred_at`, `ip inet`, `details jsonb`, политика хранения (партиционирование по месяцам, архив в Object Storage старше 1 года). Связь: глобальная append-only, не FK на сущности (чтобы переживать их удаление).

### `events` (универсальная append-only) — рассмотрена, отвергнута для Current

> **Status:** в Current реализован специализированный `task_events` (см. Current). **Не планируется к замене на универсальную таблицу в Target без явного триггера.**
>
> **Триггер пересмотра:** появление ≥ 3 типов entities, для которых независимо нужен event-log (sprint_events, comment_events, attachment_events). Сегодня единственный event-source — задачи; специализация даёт типизацию `from_column_id` / `to_column_id` без `payload jsonb`-парсинга в SQL аналитики.

Универсальная схема выглядела бы как `(id, workspace_id, occurred_at, actor_id, entity_type, entity_id, event_type, payload jsonb)`. Её плюс — единая лента audit. Минус — потеря типизации move-событий и обязательный JSON-парсинг при каждом аналитическом запросе. Пока единственный продуктовый event-source — задачи, специализация выигрывает.

### `flow_daily` — суточный агрегат для CFD

> **Status:** не реализовано в Phase 1-3 MVP. CFD считается «на лету» из `task_events` при каждом запросе.
> **Триггер ввода:** p95 latency `/api/.../analytics/cfd` > 500 мс при ≥ 100 закрытых задач/мес.

Ключевые поля: `workspace_id`, `project_id` (или `board_id` пока projects нет), `date`, `column_id`, `count_in` (вошло за день), `count_out` (вышло за день), `count_eod` (осталось на конец дня), composite PK `(workspace_id, board_id, date, column_id)`. Обновление — incrementally триггером на `task_moved` либо часовым батч-job через pg-boss.

### `cycle_time_samples` — один ряд на проход задачи через колонку

> **Status:** не реализовано в Phase 1-3 MVP. Cycle time восстанавливается на лету парами `task_events` (вход/выход колонки).
> **Триггер ввода:** вместе с bottleneck detection (см. [`docs/10-analytics-design.md`](10-analytics-design.md)) либо когда p95 latency `/api/.../analytics/cycle-time` > 500 мс на 1k задач.

Ключевые поля: `id`, `workspace_id`, `task_id`, `column_id`, `column_role`, `entered_at`, `exited_at`, `duration_seconds`. Используется для scatter plots, percentile-анализа, bottleneck-эвристик.

### `sprint_stats` — velocity и throughput per sprint

> **Status:** не реализовано в Phase 1-3 MVP.
> **Триггер ввода:** появление дашборда сравнения спринтов (UI ≥ 3 спринтов в одной таблице с трендами).

Ключевые поля: `workspace_id`, `sprint_id PK`, `planned_points`, `completed_points`, `rolled_over_points`, `throughput_tasks`, `avg_cycle_time_hours`, `computed_at`. Обновляется по событию `sprint_closed` либо ручному рефрешу.

### Materialized views (Phase 4+ optimization)

- **`mv_cfd_last_90d`** — CFD за последние 90 дней. Refresh hourly. **Триггер:** p95 latency `/api/.../analytics/cfd` > 500 мс при ≥ 100 закрытых задач/мес.
- **`mv_throughput_weekly`** — еженедельный throughput для Monte Carlo. Refresh daily. **Триггер:** Monte Carlo-запрос > 1.5 с (сейчас 50–150 мс на 1000 итераций).
- **`mv_cycle_time_percentiles`** — percentile cycle time по `column_role`. Refresh hourly. **Триггер:** p95 latency `/api/.../analytics/cycle-time` > 500 мс.

Каждый MV вводится **независимо** при достижении своего триггера. Преждевременное добавление всех трёх — лишний код миграций и cron-jobs без аналитической выгоды.

### Эволюция и общие триггеры

- **UUID v4 → v7** на новых таблицах: вводится при появлении первой курсорной пагинации, требующей time-sortable id (обычно — лента `task_events` или `audit_log` > 100k записей).
- **Partitioning** (`task_events`, `cycle_time_samples`, `audit_log`) по `workspace_id` или по времени — при > 50M строк в одной таблице.
- **Read-replica** для analytics — когда OLTP latency на write-операциях начинает страдать от тяжёлых аналитических запросов.
- **Глобальный slug → namespaced** на `workspaces`: при появлении потенциального коллизионного конфликта (два независимых заказчика хотят `acme`).

---

## Связанные документы

- [`06-system-architecture.md`](06-system-architecture.md) — как модель встраивается в систему.
- [`08-backend-design.md`](08-backend-design.md) — Drizzle и слой запросов.
- [`10-analytics-design.md`](10-analytics-design.md) — как считаются метрики.
- [`11-non-functional.md`](11-non-functional.md) — RLS-политики и multi-tenancy.
- [`docs/uml/01-use-case/roles-guide.md`](uml/01-use-case/roles-guide.md) — матрица прав 5 ролей.
- [`docs/audit-2026-05-10-issues.md`](audit-2026-05-10-issues.md) — детальный аудит расхождений docs ↔ code.
