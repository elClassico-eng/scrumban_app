# 07 — Domain Model

## Обзор

Доменная модель Scrumban-платформы состоит из четырёх логических блоков:

1. **Identity & Tenancy** — пользователи, workspace'ы, роли.
2. **Project & Board** — контейнеры работы.
3. **Task & Sprint** — собственно работа.
4. **Events & Aggregates** — история изменений и предрассчитанные срезы для аналитики.

## Универсальные правила

- Все tenant-scoped таблицы содержат `workspace_id uuid NOT NULL`.
- Composite индексы всегда начинаются с `workspace_id`.
- На каждой tenant-scoped таблице включена RLS-политика (см. `11-non-functional.md`).
- Мягкое удаление через `archived_at` / `deleted_at` (timestamptz nullable).
- Все id — UUID v7 (сортируемы по времени, удобны для курсорной пагинации).
- Все timestamps — `timestamptz` в UTC; отображение в локали — задача frontend'а.

## 1. Identity & Tenancy

### `users`
Глобальная учётная запись пользователя.
```sql
id              uuid PK (UUID v7)
email           text UNIQUE NOT NULL
password_hash   text NOT NULL          -- argon2id
name            text
avatar_url      text
locale          text DEFAULT 'ru-RU'
created_at      timestamptz NOT NULL
last_seen_at    timestamptz
deleted_at      timestamptz
```

### `workspaces` — tenant root
```sql
id              uuid PK
name            text NOT NULL
slug            text UNIQUE NOT NULL   -- для URL
plan            text NOT NULL CHECK (plan IN ('free','pro','enterprise'))
owner_id        uuid REFERENCES users(id)
settings        jsonb NOT NULL DEFAULT '{}'
created_at      timestamptz NOT NULL
archived_at     timestamptz
```

### `workspace_members`
```sql
workspace_id    uuid REFERENCES workspaces(id)
user_id         uuid REFERENCES users(id)
role            text NOT NULL CHECK (role IN ('owner','admin','member','viewer'))
joined_at       timestamptz NOT NULL
PRIMARY KEY (workspace_id, user_id)
```

### `invitations`
```sql
id              uuid PK
workspace_id    uuid NOT NULL REFERENCES workspaces(id)
email           text NOT NULL
role            text NOT NULL
token_hash      text NOT NULL
expires_at      timestamptz NOT NULL
invited_by      uuid REFERENCES users(id)
accepted_at     timestamptz
UNIQUE (workspace_id, email) WHERE accepted_at IS NULL
```

### `sessions`
Cookie-based сессии (см. `11-non-functional.md` про auth).
```sql
id              uuid PK
user_id         uuid NOT NULL REFERENCES users(id)
token_hash      text NOT NULL UNIQUE
expires_at      timestamptz NOT NULL
user_agent      text
ip              inet
created_at      timestamptz NOT NULL
revoked_at      timestamptz
```

## 2. Project & Board

### `projects`
```sql
id              uuid PK
workspace_id    uuid NOT NULL REFERENCES workspaces(id)
name            text NOT NULL
key             text NOT NULL              -- "SCB", для коротких ID задач
description     text
created_by      uuid REFERENCES users(id)
archived_at     timestamptz
created_at      timestamptz NOT NULL
UNIQUE (workspace_id, key)
```

### `boards`
```sql
id              uuid PK
workspace_id    uuid NOT NULL REFERENCES workspaces(id)
project_id      uuid NOT NULL REFERENCES projects(id)
name            text NOT NULL
type            text NOT NULL CHECK (type IN ('scrumban','scrum','kanban'))
created_at      timestamptz NOT NULL
-- В MVP: 1:1 с project
```

### `columns`
```sql
id              uuid PK
workspace_id    uuid NOT NULL
board_id        uuid NOT NULL REFERENCES boards(id)
name            text NOT NULL
order_index     int NOT NULL
wip_limit       int                        -- nullable = без лимита
wip_strict      bool NOT NULL DEFAULT false
column_role     text NOT NULL CHECK (column_role IN
                  ('backlog','in_progress','review','done','other'))
is_terminal     bool NOT NULL DEFAULT false
```

`column_role` нужен, чтобы аналитика понимала семантику («done», «in progress») независимо от того, как пользователь назвал колонку.

## 3. Task & Sprint

### `tasks` — центральная сущность
```sql
id              uuid PK (UUID v7)
workspace_id    uuid NOT NULL
project_id      uuid NOT NULL REFERENCES projects(id)
board_id        uuid NOT NULL REFERENCES boards(id)
column_id       uuid NOT NULL REFERENCES columns(id)
sprint_id       uuid REFERENCES sprints(id)   -- nullable: может быть в бэклоге
short_id        text NOT NULL                 -- "SCB-123"
title           text NOT NULL
description     text                          -- markdown
type            text NOT NULL CHECK (type IN ('story','bug','task','epic'))
priority        text NOT NULL CHECK (priority IN ('low','normal','high','urgent'))
story_points    numeric
estimate_hours  numeric
assignee_id     uuid REFERENCES users(id)
reporter_id     uuid NOT NULL REFERENCES users(id)
created_at      timestamptz NOT NULL
updated_at      timestamptz NOT NULL
closed_at       timestamptz
reopened_count  int NOT NULL DEFAULT 0
UNIQUE (workspace_id, project_id, short_id)
```

### `task_tags`
```sql
task_id         uuid REFERENCES tasks(id)
tag             varchar(64)
PRIMARY KEY (task_id, tag)
```

### `task_comments`
```sql
id              uuid PK
workspace_id    uuid NOT NULL
task_id         uuid NOT NULL REFERENCES tasks(id)
author_id       uuid NOT NULL REFERENCES users(id)
body            text NOT NULL          -- markdown
created_at      timestamptz NOT NULL
updated_at      timestamptz
deleted_at      timestamptz
```

### `task_attachments`
```sql
id              uuid PK
workspace_id    uuid NOT NULL
task_id         uuid NOT NULL REFERENCES tasks(id)
uploaded_by     uuid NOT NULL REFERENCES users(id)
object_key      text NOT NULL            -- путь в S3
filename        text NOT NULL
size_bytes      bigint NOT NULL
content_type    text NOT NULL
created_at      timestamptz NOT NULL
```

### `sprints`
```sql
id              uuid PK
workspace_id    uuid NOT NULL
project_id      uuid NOT NULL REFERENCES projects(id)
name            text NOT NULL
goal            text
start_at        timestamptz
planned_end_at  timestamptz
closed_at       timestamptz
status          text NOT NULL CHECK (status IN ('planned','active','closed'))
created_by      uuid REFERENCES users(id)
created_at      timestamptz NOT NULL
```

## 4. Events & Aggregates

### `events` — append-only журнал изменений
```sql
id              uuid PK
workspace_id    uuid NOT NULL
occurred_at     timestamptz NOT NULL
actor_id        uuid REFERENCES users(id)   -- null для system-событий
entity_type     text NOT NULL               -- 'task','sprint','column','board'
entity_id       uuid NOT NULL
event_type      text NOT NULL
payload         jsonb NOT NULL DEFAULT '{}'
```

Индексы:
- `(workspace_id, occurred_at DESC)` — для ленты/audit.
- `(workspace_id, entity_type, entity_id, occurred_at)` — для истории сущности.
- `(workspace_id, event_type, occurred_at)` — для агрегации.

**Событийная модель (MVP minimum):**
- `task_created`, `task_updated`, `task_moved_column`, `task_assigned`, `task_sprint_changed`, `task_points_changed`, `task_closed`, `task_reopened`.
- `sprint_created`, `sprint_started`, `sprint_closed`.
- `column_wip_breached` — когда добавление в колонку превышает wip_limit.

Payload примеры:
```json
// task_moved_column
{"from_column": "uuid", "to_column": "uuid", "duration_in_source_sec": 123456}

// task_points_changed
{"from": 3, "to": 5}
```

### `flow_daily` — агрегат для CFD
```sql
workspace_id    uuid NOT NULL
project_id      uuid NOT NULL
date            date NOT NULL
column_id       uuid NOT NULL
count_in        int NOT NULL       -- вошло за день
count_out       int NOT NULL       -- вышло за день
count_eod       int NOT NULL       -- осталось на конец дня
PRIMARY KEY (workspace_id, project_id, date, column_id)
```

Обновляется incrementally триггером на событии `task_moved_column` или раз в час батчем.

### `cycle_time_samples` — один ряд на проход задачи через колонку
```sql
id                 uuid PK
workspace_id       uuid NOT NULL
project_id         uuid NOT NULL
task_id            uuid NOT NULL
column_id          uuid NOT NULL
column_role        text NOT NULL
entered_at         timestamptz NOT NULL
exited_at          timestamptz NOT NULL
duration_seconds   int NOT NULL
```

Используется для scatter plots и percentile-анализа.

### `sprint_stats`
```sql
workspace_id             uuid NOT NULL
sprint_id                uuid PK REFERENCES sprints(id)
planned_points           numeric
completed_points         numeric
rolled_over_points       numeric
throughput_tasks         int
avg_cycle_time_hours     numeric
computed_at              timestamptz NOT NULL
```

### Materialized views
- `mv_cfd_last_90d` — CFD за последние 90 дней. Refresh ежечасно.
- `mv_throughput_weekly` — еженедельный throughput для Monte Carlo. Refresh ежедневно.
- Определения в SQL-миграциях; см. `10-analytics-design.md` за примерами.

## Cross-cutting

### `feature_flags`
```sql
name                 text PK
enabled_globally     bool NOT NULL DEFAULT false
allowed_workspaces   uuid[] NOT NULL DEFAULT '{}'
description          text
created_at           timestamptz NOT NULL
```

### `audit_log` (Enterprise, LATER в MVP можно минимально)
```sql
id            uuid PK
workspace_id  uuid NOT NULL
actor_id      uuid REFERENCES users(id)
action        text NOT NULL
entity_type   text NOT NULL
entity_id     uuid
occurred_at   timestamptz NOT NULL
ip            inet
details       jsonb
```

В MVP: audit живёт в `events` с пометкой `is_audit` в payload — одна таблица.
В Target: отдельная таблица, с политикой хранения и экспорта.

## Dual-track

### Current
- Схема полностью определена в миграциях.
- Все ключевые таблицы с RLS.
- Events — минимальный набор типов.
- Aggregates: `flow_daily` + `cycle_time_samples` + `sprint_stats`.
- Materialized views с ручным refresh.

### Target
- Расширенный набор event types.
- Автоматический refresh materialized views по расписанию.
- Partitioning больших таблиц (events, cycle_time_samples) по `workspace_id` или по времени.
- Отдельная `audit_log` с retention policy.

### Evolution
- Добавление новых event types не требует миграции (payload — jsonb).
- Partitioning вводится, когда таблица events превышает ~50M строк.
- Перенос analytics-таблиц на read-replica, когда OLTP начинает страдать.

## Связанные документы
- [`06-system-architecture.md`](06-system-architecture.md) — как модель встраивается в систему
- [`08-backend-design.md`](08-backend-design.md) — Drizzle и слой запросов
- [`10-analytics-design.md`](10-analytics-design.md) — как считаются метрики
- [`11-non-functional.md`](11-non-functional.md) — RLS политики