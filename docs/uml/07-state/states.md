# State Machine Diagrams

Два конечных автомата, моделирующих жизненный цикл ключевых сущностей с наиболее сложной динамикой: задачи и спринта.

## 1. Жизненный цикл задачи (Task Lifecycle)

> Исходник: [`task-lifecycle.puml`](task-lifecycle.puml). Превью — через PlantUML plugin в IDE.

### Состояния

Логические состояния задачи соответствуют `column_role` текущей колонки (см. [`../../07-domain-model.md`](../../07-domain-model.md) — раздел `board_columns`). Поле `column_role` на `columns` — значение перечисления `ColumnRole` (`BACKLOG`, `IN_PROGRESS`, `REVIEW`, `DONE`, `ARCHIVED`, `OTHER`). Статус задачи **не хранится отдельно** — он производен от её местоположения.

| Состояние | Что означает | Entry-действия |
|-----------|--------------|----------------|
| **Backlog** | Задача создана, ни в одной колонке «в работе». Обычно до планирования в спринт. | Добавление в backlog проекта |
| **In Progress** | Задача в разработке. Активно «жрёт» WIP-лимит. | Проверка WIP-лимита колонки; старт cycle time |
| **Review** | Code review / QA / приёмка. | Старт cycle_time для `column_role = REVIEW`; таймер stuck-alert — Target |
| **Done** | Задача закрыта. Влияет на velocity спринта. | `set closed_at = now()`; event `task_closed`; trigger обновления `sprint_stats` — Target |
| **Archived** | Перемещена в колонку с `column_role='archived'`. | Event `task_archived`; скрытие из основных view. **Отдельных полей `archived_at` / `deleted_at` на `tasks` нет** — состояние выражается через `column_role` целевой колонки. |

### Реальный enum событий

`task_event_type` в [`server/db/schema/tasks.ts`](../../../server/db/schema/tasks.ts) содержит **7 значений**: `task_created`, `task_moved`, `task_closed`, `task_reopened`, `task_assigned`, `task_updated`, `task_archived`. Никаких `task_moved_column` — это рабочее имя из ранних черновиков, реальный event — `task_moved`.

### Переходы

| Исход | Событие | Payload |
|-------|---------|---------|
| `[*] → Backlog` | create | `task_created` |
| `Backlog → In Progress` | move to IN_PROGRESS | `task_moved`, добавляется cycle_time_sample |
| `In Progress → Review` | move to REVIEW | `task_moved` |
| `Review → Done` | move to DONE | `task_closed`, `set closed_at = now()` |
| `Review → In Progress` | needs_rework (двигаем назад) | `task_moved`, добавляется второй проход cycle_time |
| `In Progress → Backlog` | deprioritize | `task_moved` |
| `Done → In Progress` | reopen | `task_reopened`, `reopened_count++`, `unset closed_at` |
| `* → Archived` | archive [role ≥ Admin] | `task_archived` (перенос в колонку `column_role='archived'`) |
| `Backlog → [*]` | hard delete [role ≥ Admin] | (без события — задача удаляется, см. ниже) |
| `Archived → [*]` | hard delete [role ≥ Admin] | — |

### Ключевые решения, видимые на диаграмме

1. **Состояние — через column_role, не отдельный status-атрибут.** Упрощает модель, избегает рассинхрона «task.status vs task.column.role».
2. **Review → In Progress — реальный флоу.** Если ревью провалился, задача возвращается. Это **добавляет второй проход cycle time в REVIEW**, что корректно отражается в аналитике (scatter plot покажет длинные задачи).
3. **`reopened_count` как индикатор качества.** Задача, которую несколько раз переоткрывали после закрытия, — сигнал нестабильности качества. Поле используется в «process-mining inspired» аналитике (см. [`../../10-analytics-design.md`](../../10-analytics-design.md)).
4. **Archive ≠ hard delete.** Archive переводит в терминальное состояние через перенос в колонку `column_role='archived'`, запись остаётся в БД. Это даёт audit trail.

### Известное ограничение Current

`deleteTask` ([`server/services/tasks.service.ts:160-182`](../../../server/services/tasks.service.ts)) выполняет **hard delete**, требует `role ≥ Admin`, но **не проверяет**, что по задаче не было работы. Поскольку `task_events.task_id` ссылается на `tasks.id` с `ON DELETE CASCADE`, удаление задачи стирает всю её историю из event log. Это разрушает воспроизводимость CFD/Monte Carlo для исторических периодов, если в них была эта задача. Target — заменить hard delete на soft delete через Archived. См. [`../../07-domain-model.md`](../../07-domain-model.md) → Quirks.

## 2. Жизненный цикл спринта (Sprint Lifecycle)

> Исходник: [`sprint-lifecycle.puml`](sprint-lifecycle.puml). Превью — через PlantUML plugin в IDE.

### Состояния (3-state enum, без Cancelled)

`sprint_state` в [`server/db/schema/sprints.ts`](../../../server/db/schema/sprints.ts) содержит **3 значения**: `planned`, `active`, `closed`. Отдельного состояния `cancelled` нет — это сознательное решение Current.

| Состояние | Что означает | Entry-действия (Current) |
|-----------|--------------|--------------------------|
| **Planned** | Создан, добавляется в бэклог спринтов. Можно менять даты, задачи. | Команда добавляет задачи; редактирование плановых дат |
| **Active** | Идёт. Задачи работаются, cycle time копится. | `started_at = now()`, `state = 'active'`. Guard: partial unique index `sprints_one_active_per_board_idx` |
| **Closed** | Завершён. | `ended_at = now()`, `state = 'closed'`. **Только смена state и запись `ended_at`** — никаких триггеров аналитики или rollover в Current. |

### Переходы

| Исход | Событие | Guard / эффект (Current) |
|-------|---------|--------------------------|
| `[*] → Planned` | create sprint | `role ≥ Scrum Master` |
| `Planned → Active` | start | `role ≥ Scrum Master`; БД-инвариант «не более одного active на доске» — partial unique index |
| `Active → Closed` | close | `role ≥ Scrum Master`; `ended_at = now()` |
| `Planned → Closed` | cancel (shortcut: never-started) | `role ≥ Scrum Master`; закрытие без захода в Active |

### Что в диаграмме помечено как Target

Эти элементы есть в диаграмме как `<i>Target</i>` подписи к состояниям, но **не реализованы в Current**:

- **События `sprint_started` / `sprint_closed`** — не пишутся в `task_events` (enum не содержит их).
- **SSE broadcast при смене состояния спринта** — sprint-scoped SSE не реализован.
- **Пересчёт `sprint_stats`** — таблицы не существует (Target из [`../../07-domain-model.md`](../../07-domain-model.md)).
- **Обновление Monte Carlo прогноза следующего спринта** — Target (см. [`../../10-analytics-design.md`](../../10-analytics-design.md)).
- **Rollover unclosed задач в следующий Planned** — Phase 4+ (см. [`../../05-mvp-scope-and-roadmap.md`](../../05-mvp-scope-and-roadmap.md)).

### Ключевые решения, видимые на диаграмме

1. **Одновременно только один Active спринт на доске.** Инвариант enforced на уровне БД через `sprints_one_active_per_board_idx` (partial unique index, см. [`server/services/sprints.service.ts:167-172`](../../../server/services/sprints.service.ts)). Это упрощает аналитику (нет пересечения спринтов).
2. **Planned может быть несколько.** Команда планирует заранее следующий спринт до закрытия текущего.
3. **Нет отдельного состояния `Cancelled`.** Отмена ещё не стартовавшего спринта = переход `Planned → Closed` без захода в Active. Преимущество: 3-state enum проще, единый терминал `Closed` для аналитики. Недостаток: без отдельного флага «отменён» отличить «закрылся успешно» от «отменили до старта» можно только по `started_at IS NULL`. Trade-off задокументирован, в Phase 4+ может быть пересмотрен.
4. **Closed — точка триггера аналитики (Target).** В Current это просто смена state; в Target entry-действие состояния `Closed` запускает пересчёт `sprint_stats` и обновление Monte Carlo прогноза.

## Почему только эти два автомата

Другие сущности имеют **тривиальный жизненный цикл**:
- `User` — создан → активен → deleted (soft). 3 состояния, линейно.
- `Project`, `Board`, `Workspace` — `Active → Archived`. Двухсостоянный.
- `Invitation` — `pending → accepted` или `pending → expired`. Двухсостоянный.
- `Session` — `active → revoked/expired`. Двухсостоянный.
- `Event` — не меняется (append-only), нет состояний.

Их lifecycle описывается таблицей в тексте диплома без диаграмм.

## Общие архитектурные принципы

1. **Каждый переход порождает event (Current — для tasks; Target — для sprints).** Это даёт полный audit trail и делает возможным «process-mining inspired» восстановление того, как задача прошла через систему.
2. **Guard'ы на переходах — RBAC-проверки + БД-инварианты.** Модель доступа из [`../../11-non-functional.md`](../../11-non-functional.md) отражается в условиях переходов состояний; уникальные инварианты (один active sprint на доске) enforced на уровне БД через partial unique index.
3. **Entry-действия — побочные эффекты.** Обновление агрегатов, SSE broadcast, enqueue фоновых задач — всё привязано к состояниям; для sprints большая часть этих эффектов пока в Target.
4. **Archive — не hard delete (для задач).** Archived = move в колонку с `column_role='archived'`. Hard delete доступен из `Backlog` и `Archived` для admin+, но имеет известное ограничение (см. выше).

## Связь с другими артефактами

- **Domain model:** [`../../07-domain-model.md`](../../07-domain-model.md) — поля `closed_at`, `reopened_count` на tasks; `state`, `started_at`, `ended_at` на sprints; Quirks с описанием task_events CASCADE.
- **Analytics design:** [`../../10-analytics-design.md`](../../10-analytics-design.md) — как переходы состояний используются в CFD, cycle time samples, Monte Carlo; `sprint_stats` как Target.
- **Sequence diagrams:** [`../06-sequence/`](../06-sequence/) — как переходы происходят во времени в реальном коде.
- **Roadmap:** [`../../05-mvp-scope-and-roadmap.md`](../../05-mvp-scope-and-roadmap.md) — Phase 4+ rollover, sprint analytics triggers.
- **Non-functional:** [`../../11-non-functional.md`](../../11-non-functional.md) — RBAC-роли, фигурирующие в guard'ах переходов.
