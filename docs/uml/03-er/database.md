# ER-диаграмма БД

Физическая схема базы данных PostgreSQL 16+ для Scrumban-платформы. Показывает таблицы с точными типами данных, первичными и внешними ключами, индексами, уникальными ограничениями.

![ER Diagram](database.svg)

> Исходник PlantUML: [`database.puml`](database.puml). Регенерация: `plantuml -tsvg database.puml`.

## Обзор

Схема состоит из **19 сущностей**, сгруппированных по функциональным зонам:

| Зона | Таблицы |
|------|---------|
| Identity & Tenancy | `users`, `workspaces`, `workspace_members`, `invitations`, `sessions` |
| Project & Board | `projects`, `boards`, `columns` |
| Task & Sprint | `tasks`, `task_tags`, `task_comments`, `task_attachments`, `sprints` |
| Events & Aggregates | `events`, `flow_daily`, `cycle_time_samples`, `sprint_stats` |
| Cross-cutting | `feature_flags` |

## Условные обозначения

- `*` — NOT NULL;
- `o` (нет звезды) — Nullable;
- `<<PK>>` — первичный ключ;
- `<<FK>>` — внешний ключ;
- `<<U>>` — уникальное ограничение;
- `<<I>>` — наличие индекса;
- `<<RLS>>` — Row-Level Security включена на таблице.

Связи изображены в нотации «crow's foot» (кратности):
- `||` — ровно один;
- `|o` — ноль или один;
- `}|` — один или несколько;
- `}o` — ноль или несколько.

## Ключевые архитектурные решения

### 1. Tenant isolation через `workspace_id` + RLS
**Все бизнес-таблицы** содержат колонку `workspace_id uuid NOT NULL` с foreign key на `workspaces.id`. На каждой такой таблице включена политика Row-Level Security:

```sql
ALTER TABLE <table> ENABLE ROW LEVEL SECURITY;
CREATE POLICY <table>_tenant_isolation ON <table>
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
```

Это hard guard от случайного cross-tenant доступа: даже при ошибке в коде (забытый `WHERE`), Postgres автоматически вернёт 0 строк. См. [`../../11-non-functional.md#multi-tenancy`](../../11-non-functional.md).

### 2. Composite-индексы начинаются с `workspace_id`
Все индексы на tenant-scoped таблицах имеют вид `(workspace_id, ...)` — это согласовано с RLS: планировщик Postgres эффективно использует такие индексы после фильтрации по tenant.

Важные композитные индексы:
- `tasks(workspace_id, project_id, short_id)` — UNIQUE, для lookup по "SCB-42".
- `events(workspace_id, occurred_at DESC)` — лента изменений.
- `events(workspace_id, entity_type, entity_id, occurred_at)` — история одной сущности.
- `events(workspace_id, event_type, occurred_at)` — аналитика по типу события.

### 3. `workspace_members` — ассоциативная таблица
Разрешает many-to-many между `users` и `workspaces` с дополнительными атрибутами (`role`, `joined_at`). Primary key — композитный `(workspace_id, user_id)`, что гарантирует ровно одно членство пользователя в workspace'е.

### 4. `events` — append-only журнал
Никогда не апдейтится, не удаляется. Источник данных для всех аналитических агрегатов. `payload` типа `jsonb` даёт гибкость — новые типы событий не требуют миграции схемы. Три индекса покрывают основные паттерны запросов (лента, история сущности, аналитика по типу).

### 5. Агрегаты как отдельные таблицы
`flow_daily`, `cycle_time_samples`, `sprint_stats` — предрассчитанные срезы над `events`:
- **`flow_daily`** — композитный PK `(workspace_id, project_id, date, column_id)`, одна строка на колонку × день. Источник CFD.
- **`cycle_time_samples`** — один ряд на каждый проход задачи через колонку. Источник scatter plot и percentile-аналитики.
- **`sprint_stats`** — один ряд на спринт, обновляется при закрытии и ежечасно для активного.

Обновляются инкрементально триггерами или фоновыми job'ами; см. [`../../10-analytics-design.md`](../../10-analytics-design.md).

### 6. Soft delete через nullable timestamps
Колонки `archived_at` / `deleted_at` / `revoked_at` — вместо жёсткого `DELETE`. Даёт audit trail и возможность восстановления.

### 7. UUID v7 как ID
Все идентификаторы — UUID v7 (сортируемы по времени). Удобно для курсорной пагинации (`WHERE id > last_seen_id ORDER BY id`), не даёт «дыр» в нумерации, нет race conditions при распределённой генерации.

### 8. `timestamptz` в UTC везде
Все временны́е поля — `timestamptz`, хранятся в UTC. Локализация времени — задача frontend'а (через `Intl.DateTimeFormat` или аналог). Это устраняет целый класс ошибок с часовыми поясами.

## Необычные решения и их причины

| Решение | Причина |
|---------|---------|
| `short_id` как текстовое поле в `tasks` | UUID неудобен для UI и ссылок; `SCB-42` читаемо. Генерируется из `project.key + auto_increment` |
| `payload : jsonb` в `events` | Гибкость: новые типы событий не требуют миграций схемы |
| `column_role` отдельно от `name` | Аналитика не зависит от имён колонок у пользователя |
| `status` в `sprints` как text (не enum) | Облегчает миграции; `CHECK` constraint гарантирует валидность |
| `allowed_workspaces : uuid[]` в `feature_flags` | Avoidance отдельной many-to-many таблицы при малом объёме данных |

## Миграционная стратегия

- **Инструмент:** `drizzle-kit` (см. [`../../08-backend-design.md`](../../08-backend-design.md)).
- **Файлы:** `drizzle/migrations/XXXX_*.sql` (генерируются автоматически из изменений Drizzle schema).
- **Запуск:** при старте Nitro плагина (`pnpm db:migrate`); защита от гонок — advisory lock в Postgres.
- **Rollback:** down-миграции пишутся вручную как отдельные SQL-файлы; за пределы недавних — ручное вмешательство.

## Связь с другими артефактами

- **Class (domain) diagram:** [`../02-class/`](../02-class/) — логическая модель, вид «сверху».
- **Domain model document:** [`../../07-domain-model.md`](../../07-domain-model.md) — SQL-типы, RLS-политики, миграционная политика.
- **Analytics design:** [`../../10-analytics-design.md`](../../10-analytics-design.md) — как `events` и агрегаты используются в расчётах CFD, Monte Carlo, percentiles.
- **Non-functional:** [`../../11-non-functional.md`](../../11-non-functional.md) — RLS-политики в деталях, RBAC-матрица.
