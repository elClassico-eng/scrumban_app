# Диаграмма классов — Доменная модель (Current)

Статическая структура реализованных классов Scrumban-платформы. Источник истины для **доменной модели и физической схемы БД** (отдельная ER-диаграмма не ведётся — её роль выполняет class diagram + Drizzle SQL-миграции в [`drizzle/migrations/`](../../../drizzle/migrations/)).

> Исходник PlantUML: [`domain-classes.puml`](domain-classes.puml). Preview — через PlantUML plugin в IDE.

## Что покрывает диаграмма

**9 классов** (по одному на реализованную таблицу в [`server/db/schema/`](../../../server/db/schema/)):

| Блок | Классы |
|------|--------|
| Identity & Tenancy | `User`, `Workspace`, `WorkspaceMember` |
| Boards | `Board`, `BoardColumn` |
| Tasks | `Task`, `TaskEvent` |
| Sprints | `Sprint`, `SprintTask` |

**5 enum'ов** (соответствие коду подтверждено в [`docs/07-domain-model.md`](../../07-domain-model.md)):

| Enum | Значения | Где |
|------|----------|-----|
| `WorkspaceRole` | `viewer`, `member`, `scrum_master`, `admin`, `owner` | `workspaces.ts` (5 значений, иерархия в [`server/utils/rbac.ts`](../../../server/utils/rbac.ts)) |
| `SprintState` | `planned`, `active`, `closed` | `sprints.ts` (3 значения, без `cancelled`) |
| `ColumnRole` | `backlog`, `in_progress`, `review`, `done`, `archived` | `boards.ts` (5 значений, без `other`) |
| `TaskPriority` | `low`, `medium`, `high` | `tasks.ts` (3 значения, без `normal`/`urgent`) |
| `TaskEventType` | `task_created`, `task_moved`, `task_closed`, `task_reopened`, `task_assigned`, `task_updated`, `task_archived` | `tasks.ts` (7 значений) |

## Ключевые сущности

### Workspace (корень мультитенантности)
Стереотип `<<tenant root>>`. Все дочерние таблицы (`boards`, `tasks`, `task_events`, `sprints`, `sprint_tasks`) содержат `workspace_id` с FK `ON DELETE CASCADE` — это позволяет RLS-политикам делать плоский `WHERE workspace_id = current_setting(...)` без JOIN'ов. RLS включён на 6 из 9 таблиц (см. [`docs/07-domain-model.md` → Current](../../07-domain-model.md#current-phase-1-3-mvp)).

### User
Глобальная (не tenant-scoped) учётная запись. `email` уникален на уровне БД; lower-casing — задача сервис-слоя. Хеш — **scrypt** через `nuxt-auth-utils.hashPassword()` (argon2id опционален при установке `@node-rs/argon2`).

### WorkspaceMember
Composite PK `(workspaceId, userId)` — никаких отдельных `id`-колонок и UNIQUE-индексов. Поля `owner_id` на `Workspace` нет: владелец вычисляется как член с `role='owner'`.

### Task (центральная сущность)
- `columnId` определяет lifecycle (нет отдельного `status`-поля).
- `closedAt` проставляется при входе в колонку с `columnRole='done'`.
- `reopenedCount` инкрементируется при выходе обратно в working states.
- Связь со спринтом — через join-таблицу `SprintTask`, не через `sprintId` на задаче.
- Полей `short_id`, `type`, `storyPoints`, `estimateHours`, `reporterId`, `archivedAt` **нет** — отнесены в Target.

### TaskEvent (append-only журнал)
Стереотип `<<append-only>>` — только INSERT, никаких UPDATE/DELETE на ряд. Поля `fromColumnId` / `toColumnId` — типизированные `uuid`-колонки **без FK** на `BoardColumn` (квирк — см. ниже). `payload jsonb` хранит контекстно-зависимые данные (например, `{"oldPriority":"low","newPriority":"high"}` для `task_updated`). Это специализированный журнал именно по задачам, не универсальный `events` с `entity_type`/`entity_id` (universal-events рассматривался и осознанно отвергнут — см. Target в `07`).

## Ключевые ограничения и индексы (видные из диаграммы)

| Ограничение | Где | Зачем |
|-------------|-----|-------|
| `tasks.column_id` ON DELETE **RESTRICT** | `tasks` | Защита от тихой потери: колонку с задачами нельзя удалить, сервис обязан переместить/архивировать. |
| `tasks.assignee_id` ON DELETE **SET NULL** | `tasks` | Удаление пользователя оставляет задачу без исполнителя, не уничтожает её. |
| `task_events.task_id` ON DELETE **CASCADE** | `task_events` | Известное ограничение: удаление задачи стирает её историю (Target — SET NULL + snapshot). |
| `task_events.actor_id` ON DELETE **SET NULL** | `task_events` | История переживает удаление пользователя как анонимная. |
| Partial UNIQUE INDEX `(boardId) WHERE state='active'` | `sprints` | Не более одного активного спринта на доску, enforced на уровне БД. |
| PRIMARY KEY `(sprintId, taskId)` | `sprint_tasks` | M:N с защитой от дублей; carry-over в следующий спринт допустим. |
| UNIQUE INDEX `(boardId, position)` | `board_columns` | Сортировка колонок без коллизий. |
| UNIQUE INDEX `(workspaceId, slug)` | `boards` | Slug уникален в пределах workspace, не глобально. |
| UNIQUE `(slug)` глобально | `workspaces` | Известное ограничение (намечено в Target — namespacing). |

## Quirks (структурные особенности)

1. **`task_events.from_column_id` / `to_column_id` — без FK на `board_columns`.** Сделано осознанно: при удалении колонки исторические события должны выживать как «висячие» снапшоты. Trade-off — невозможно через FK гарантировать существование колонки на момент создания события; корректность отслеживается в `server/services/tasks.service.ts`.
2. **`task_events.task_id` ON DELETE CASCADE — известное ограничение.** Зафиксировано в `docs/audit-2026-05-10-issues.md` раздел 7. Target — либо `SET NULL` с `payload.task_snapshot`, либо `RESTRICT` с soft-delete на самой задаче.

## Кратности (multiplicity) — важные случаи

| Связь | Кратность | Пояснение |
|-------|-----------|-----------|
| `Workspace — WorkspaceMember` | `1 : 1..*` | Минимум один участник — owner. |
| `User — WorkspaceMember` | `1 : 0..*` | Пользователь может не состоять ни в одном workspace. |
| `Workspace — Board` | `1 : 0..*` | Workspace может быть пустой. |
| `Board — BoardColumn` | `1 : 1..*` | Минимум одна колонка (на практике team создаёт ≥ 2). |
| `Board — Task` | `1 : 0..*` | Задачи живут на доске. |
| `BoardColumn — Task` | `1 : 0..*` | Текущая локация задачи (RESTRICT при удалении колонки). |
| `User — Task (assignee)` | `0..1 : 0..*` | Задача может быть без исполнителя; SET NULL при удалении. |
| `Task — TaskEvent` | `1 : 0..*` | Композиция (CASCADE) — история живёт пока живёт задача. |
| `Board — Sprint` | `1 : 0..*` | Доска может не иметь спринтов (pure-Kanban режим). |
| `Sprint — SprintTask`, `Task — SprintTask` | `1 : 0..*` | M:N с composite PK (sprintId, taskId). |

## Что НЕ показано (Target — отложено)

В диаграмме намеренно **нет** следующих сущностей — все они описаны с измеримыми триггерами в [`docs/07-domain-model.md` → Target](../../07-domain-model.md#target-phase-4):

- **`projects`** — контейнер досок (триггер: ≥ 3 активных досок в workspace).
- **`task_comments`**, **`task_attachments`**, **`task_tags`** — расширение задачи (триггеры: размер команды, наличие Object Storage, ≥ 50 активных задач).
- **`invitations`** — magic-link приглашения (триггер: первый публичный регистр).
- **`sessions`** — серверное хранилище (рассмотрено и отвергнуто; триггер пересмотра — глобальный revoke).
- **`feature_flags`** — флаги фич (триггер: второй платный клиент).
- **`audit_log`** — Enterprise-аудит (триггер: первый compliance-клиент).
- **`flow_daily`**, **`cycle_time_samples`**, **`sprint_stats`** — денормализованные агрегаты (триггер: p95 latency аналитики > 500 мс).
- **3 materialized views** (`mv_cfd_last_90d`, `mv_throughput_weekly`, `mv_cycle_time_percentiles`) — оптимизация при росте объёма.

Также **не** добавлены поля, которые часто хочется иметь, но в Phase 1-3 их нет:
- `User.name` / `User.avatarUrl` / `User.locale` — auth-only учётка.
- `Workspace.plan` / `Workspace.settings` / `Workspace.archivedAt` — биллинг и settings отнесены в Target.
- `Task.shortId` (`SCB-42`), `Task.type` (`story/bug/...`), `Task.storyPoints`, `Task.archivedAt`, `Task.reporterId` — все в Target.
- `Sprint.createdBy` — отнесено к `audit_log` в Target.

## Связь с другими артефактами

- [`docs/07-domain-model.md`](../../07-domain-model.md) — текстовый источник истины: SQL-типы, индексы, RLS-политики, триггеры эволюции для Target.
- [`server/db/schema/`](../../../server/db/schema/) — Drizzle ORM-определения, source of truth для физической схемы.
- [`drizzle/migrations/`](../../../drizzle/migrations/) — SQL-миграции (RLS-политики, partial unique index'ы).
- [`server/utils/rbac.ts`](../../../server/utils/rbac.ts) — иерархия ролей (`viewer:0 < member:1 < scrum_master:2 < admin:3 < owner:4`).
- [`docs/uml/01-use-case/roles-guide.md`](../01-use-case/roles-guide.md) — матрица прав 5 ролей.
- [`docs/uml/06-sequence/`](../06-sequence/) — как экземпляры классов взаимодействуют во времени.
