# State Machine Diagrams

Два конечных автомата, моделирующих жизненный цикл ключевых сущностей с наиболее сложной динамикой: задачи и спринта.

## 1. Жизненный цикл задачи (Task Lifecycle)

![Task State Machine](task-lifecycle.svg)

> Исходник: [`task-lifecycle.puml`](task-lifecycle.puml). Регенерация: `plantuml -tsvg task-lifecycle.puml`.

### Состояния

Логические состояния задачи соответствуют `column_role` текущей колонки (см. [ER-диаграмму](../03-er/database.md)). Поле `column_role` на `columns` — значение перечисления `ColumnRole` (`BACKLOG`, `IN_PROGRESS`, `REVIEW`, `DONE`, `OTHER`). Статус задачи **не хранится отдельно** — он производен от её местоположения.

| Состояние | Что означает | Entry-действия |
|-----------|--------------|----------------|
| **Backlog** | Задача создана, ни в одной колонке «в работе». Обычно до планирования в спринт. | Добавление в backlog проекта |
| **In Progress** | Задача в разработке. Активно «жрёт» WIP-лимит. | Проверка WIP-лимита колонки; старт cycle time |
| **Review** | Code review / QA / приёмка. | Старт cycle_time для `column_role = REVIEW`; таймер stuck-alert |
| **Done** | Задача закрыта. Влияет на velocity спринта. | `set closed_at = now()`; event `task_closed`; trigger обновления `sprint_stats` |
| **Archived** | Soft-deleted (редко). | `set deleted_at = now()`; скрытие из view |

### Переходы

| Исход | Событие | Payload |
|-------|---------|---------|
| `Backlog → In Progress` | move to IN_PROGRESS | `task_moved_column`, добавляется cycle_time_sample |
| `In Progress → Review` | move to REVIEW | `task_moved_column` |
| `Review → Done` | move to DONE | `task_closed` |
| `Review → In Progress` | needs_rework (двигаем назад) | `task_moved_column`, добавляется второй проход cycle_time |
| `In Progress → Backlog` | deprioritize | `task_moved_column` |
| `Done → In Progress` | reopen | `task_reopened`, `reopened_count++`, `unset closed_at` |
| `* → Archived` | archive [role ≥ Admin] | `task_archived` |

### Ключевые решения, видимые на диаграмме

1. **Состояние — через column_role, не отдельный status-атрибут.** Упрощает модель, избегает рассинхрона «task.status vs task.column.role».
2. **Review → In Progress — реальный флоу.** Если ревью провалился, задача возвращается. Это **добавляет второй проход cycle time в REVIEW**, что корректно отражается в аналитике (scatter plot покажет длинные задачи).
3. **`reopened_count` как индикатор качества.** Задача, которую несколько раз переоткрывали после закрытия, — сигнал нестабильности качества. Поле используется в будущей аналитике «flakiness».
4. **Soft delete, не hard delete.** Archive переводит в терминальное состояние, но запись остаётся в БД. Обеспечивает audit trail.

## 2. Жизненный цикл спринта (Sprint Lifecycle)

![Sprint State Machine](sprint-lifecycle.svg)

> Исходник: [`sprint-lifecycle.puml`](sprint-lifecycle.puml). Регенерация: `plantuml -tsvg sprint-lifecycle.puml`.

### Состояния

| Состояние | Что означает | Entry-действия |
|-----------|--------------|----------------|
| **Planned** | Создан, добавляется в бэклог спринтов. Можно менять даты, задачи. | Команда добавляет задачи; редактирование плановых дат |
| **Active** | Идёт. Задачи работаются, cycle time копится. | `start_at = now()`, `status = 'active'`; event `sprint_started`; старт hourly MC refresh job; SSE broadcast |
| **Closed** | Завершён. | `closed_at = now()`, `status = 'closed'`; event `sprint_closed`; пересчёт `sprint_stats`; обновление MC прогноза следующего спринта; unclosed задачи rollover в следующий Planned |

### Переходы

| Исход | Событие | Guard |
|-------|---------|-------|
| `[*] → Planned` | create sprint | `role ≥ Scrum Master` |
| `Planned → Active` | start | `role ≥ Scrum Master` AND нет другого active в проекте |
| `Active → Closed` | close | `role ≥ Scrum Master` |
| `Planned → Closed` | cancel | `role ≥ Admin`; задачи возвращаются в бэклог |

### Ключевые решения, видимые на диаграмме

1. **Одновременно только один Active спринт в проекте.** Guard на переходе `Planned → Active` проверяет этот инвариант. Это упрощает аналитику (нет «пересечения» спринтов).
2. **Planned может быть несколько.** Команда планирует заранее следующий спринт до закрытия текущего.
3. **Закрытие спринта — точка триггера аналитики.** Entry-действие состояния Closed запускает пересчёт `sprint_stats`, что в свою очередь обновляет Monte Carlo прогноз для следующего спринта.
4. **Rollover задач при закрытии.** Незакрытые задачи возвращаются в бэклог (или автоматически копируются в следующий Planned, если выбрана такая опция). Это отражает реальную Scrumban-практику.
5. **Cancel из Planned — краевой случай.** Редкий, но реальный (проект заморожен, приоритеты поменялись). Не рассматривается как «ошибка».

## Почему только эти два автомата

Другие сущности имеют **тривиальный жизненный цикл**:
- `User` — создан → активен → deleted (soft). 3 состояния, линейно.
- `Project`, `Board`, `Workspace` — `Active → Archived`. Двухсостоянный.
- `Invitation` — `pending → accepted` или `pending → expired`. Двухсостоянный.
- `Session` — `active → revoked/expired`. Двухсостоянный.
- `Event` — не меняется (append-only), нет состояний.

Их lifecycle описывается таблицей в тексте диплома без диаграмм.

## Общие архитектурные принципы

1. **Каждый переход порождает event.** Это даёт полный audit trail и делает возможным process mining (восстановление того, как задача прошла через систему).
2. **Guard'ы на переходах — RBAC-проверки.** Модель доступа из [`../../11-non-functional.md`](../../11-non-functional.md) отражается в условиях переходов состояний.
3. **Entry-действия — побочные эффекты.** Обновление агрегатов, SSE broadcast, enqueue фоновых задач — всё привязано к состояниям, не разбросано по коду.
4. **Soft delete через Archived.** Ни задача, ни спринт не удаляются из БД полностью. Archive — терминальное состояние, но запись остаётся.

## Связь с другими артефактами

- **Domain model:** [`../../07-domain-model.md`](../../07-domain-model.md) — поля `closed_at`, `reopened_count`, `status` на tasks и sprints.
- **ER diagram:** [`../03-er/`](../03-er/) — физическая схема с этими полями.
- **Analytics design:** [`../../10-analytics-design.md`](../../10-analytics-design.md) — как переходы состояний используются в CFD, cycle time samples, Monte Carlo.
- **Sequence diagrams:** [`../06-sequence/`](../06-sequence/) — как переходы происходят во времени в реальном коде.
- **Non-functional:** [`../../11-non-functional.md`](../../11-non-functional.md) — RBAC-роли, фигурирующие в guard'ах переходов.
