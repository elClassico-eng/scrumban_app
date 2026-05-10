# Диаграммы последовательности

Два ключевых сценария работы Scrumban-платформы в виде UML-диаграмм последовательности (sequence diagram). Обе синхронизированы с Current-кодом (ветка `docs/code-sync-2026-05-10`).

## Выбор сценариев

Из десятков возможных сценариев оставлены **2 самых репрезентативных** — каждый иллюстрирует архитектурный аспект, отличающий Scrumban-платформу:

1. **Create task + SSE broadcast** — event-driven модель и real-time обновления доски.
2. **Monte Carlo forecast** — основной дифференциатор продукта (B+ аналитика) с честным min-data threshold.

Login-флоу убран в [UML cleanup](../README.md): это типовой auth-сценарий (argon2id + cookie + nuxt-auth-utils), параметры описаны в [`../../11-non-functional.md#authn`](../../11-non-functional.md). Отдельная диаграмма не добавляла инсайта.

## 1. Сценарий «Создание задачи с real-time обновлением» (Current)

> Исходник: [`create-task-sse.puml`](create-task-sse.puml). Preview через PlantUML plugin в IDE.

### Ключевые точки (что есть в коде)

- **Предусловие**: Browser B уже подключён к SSE-потоку через `GET /api/workspaces/[id]/boards/[boardId]/stream` ([`server/api/.../stream.get.ts`](../../../server/api/workspaces/[id]/boards/[boardId]/stream.get.ts)). Соединение держится открытым, heartbeat `: ping` каждые 25 с защищает от idle-таймаутов прокси.
- **Browser A создаёт задачу**: `POST /api/workspaces/[id]/boards/[boardId]/tasks` ([`server/api/.../tasks/index.post.ts`](../../../server/api/workspaces/[id]/boards/[boardId]/tasks/index.post.ts)) с body `{ columnId, title, description?, priority?, assigneeId? }`. URL содержит `workspaceId` и `boardId`; `project_id` в схеме нет — задачи привязаны к доске напрямую.
- **In-handler guards** (нет папки `server/middleware/`): `requireAuth` → `getWorkspaceForUserOrThrow` → `requireMinRole(role, 'member')` в первых строках handler'а.
- **Tenant-isolation через `withTenant(workspaceId, tx)`** ([`server/utils/db.ts`](../../../server/utils/db.ts)): `SELECT set_config('app.workspace_id', $1, true)` в транзакции — RLS-политики на `tasks` и `task_events` фильтруют по этому GUC.
- **Транзакция охватывает task + task_events**: `INSERT INTO tasks` + `INSERT INTO task_events(event_type='task_created', from_column_id=null, to_column_id, ...)`. Если упадёт audit-запись — откатится и сама задача (атомарность).
- **Publish ПОСЛЕ commit'а**: `publishBoardEvent({ type: 'task.created', ... })` ([`server/utils/events.ts`](../../../server/utils/events.ts)) выполняется в `.then()` после транзакции — фантомных событий о неуспешной операции не бывает.
- **In-process EventEmitter** рассылает по каналу `board:{boardId}`. SSE-handler подписан через `subscribeBoardEvents(boardId, handler)` и пушит JSON-сериализованный event в открытый `createEventStream`.
- **Browser B получает `event: task.created`** и инвалидирует кэш `@tanstack/vue-query`. Browser A после ответа `201 Created` тоже инвалидирует — задача появляется на обоих экранах.

### Что НЕ реализовано (Target)

- **Cross-node fan-out через pg LISTEN/NOTIFY** — только когда появится 2-я реплика Nitro (см. [`../../06-system-architecture.md`](../../06-system-architecture.md) → Target).
- **pg-boss workers, Telegram/Pachca интеграции, Caddy sticky-cookie sessions** — все Target. Сейчас single-instance Nitro, Caddy не настроен, pg-boss не установлен.
- **Optimistic UI на стороне Browser A** — Pinia-store update до ответа сервера не реализован, ждём `201` и затем инвалидируем query.

### Почему SSE, не WebSocket

Рассылка односторонняя (server → client). Двусторонняя связь не нужна для real-time обновления доски. SSE проще: обычное HTTP keep-alive, авто-переподключение `EventSource` на стороне браузера, без отдельного сервера.

## 2. Сценарий «Monte Carlo прогноз завершения работ» (Current)

> Исходник: [`monte-carlo.puml`](monte-carlo.puml). Preview через PlantUML plugin в IDE.

### Ключевые точки (что есть в коде)

- **Endpoint**: `GET /api/workspaces/[id]/boards/[boardId]/analytics/monte-carlo?tasksRemaining=N&horizonDays=H&iterations=K` ([`server/api/.../analytics/monte-carlo.get.ts`](../../../server/api/workspaces/[id]/boards/[boardId]/analytics/monte-carlo.get.ts)). Параметры — query string, не sprint-row.
- **Источник истории — `task_events` за `HISTORY_LOOKBACK_DAYS = 90` дней**, тип `task_closed`. Никаких `sprint_stats` или `mv_throughput_weekly` — этих таблиц/MV в Current нет.
- **`expandWithZeros`** разворачивает результат GROUP-BY в вектор длиной 90 с нулями в дни без закрытий — иначе bias в сторону «всегда что-то закрывают».
- **Min-data threshold**: `totalClosed === 0 || sampleDays < MIN_DAYS_OF_HISTORY (14)` → `{ ok: false, reason: 'insufficient_data', sampleDays, requiredDays: 14 }`. Threshold по дням истории, а НЕ по числу закрытых спринтов («≥3 sprints») — sprint-scoped аналитика отложена в Target.
- **Bootstrap-семплинг**: `DEFAULT_ITERATIONS = 1000` итераций (clamped до 10 000). В каждой — суммируем сэмплы из `dailyThroughput` (with replacement) пока `total ≥ tasksRemaining` или закончится `horizonDays`. Записываем `completionDays` (`day + 1` или `H + 1`).
- **Возвращаемый объект**: `{ ok: true, iterations, sampleDays, historicalDailyThroughput, probability, percentileDays: { p50, p85, p95 } }`.

### Что НЕ реализовано (Target)

- **Forecast cache (LRU, TTL 15 мин)** — отложено до триггера: Monte Carlo p95 latency > 1.5 с (см. [`../../10-analytics-design.md`](../../10-analytics-design.md) → Target). Сейчас замер локально: 50–150 мс на 1000 итераций — кэш экономически не оправдан.
- **Sprint-scoped variant `/sprints/{id}/forecast`** — отложено вместе с `sprint_stats` MV. Когда появится — будет считать `tasksRemaining` из `sprint_tasks WHERE closed_at IS NULL`, threshold переедет на «≥ 3 закрытых спринта».
- **Текстовое объяснение «explanation»** в payload — UI-слой, ещё не написан.

### Математическая суть алгоритма

Дневной throughput моделируется как эмпирическое распределение:

`D ~ Empirical({historicalDailyThroughput[]})  // длиной 90, с нулями для дней без закрытий`

Задачи-остаток — `N`. Сколько дней до закрытия?

`T = min { t : sum(D_1..D_t) >= N }   при условии t ≤ horizonDays`

Распределение `T` строится симуляцией (1000 независимых розыгрышей). Перцентили — из отсортированного массива `completionDays`.

Вероятность успеть в горизонт:

`probability = |{t in completionDays : t ≤ horizonDays}| / iterations`

### Почему bootstrap, а не среднее × дни

Подробно — в [`../../10-analytics-design.md`](../../10-analytics-design.md). Коротко: на малых выборках (90 дней истории) среднее теряет хвосты распределения. Bootstrap семплирует исходную форму распределения без предположений о её виде (нормальность / Пуассон / экспоненциальность) — это устойчиво и интерпретируемо.

## Общие архитектурные решения, видимые из sequence-диаграмм

1. **In-handler guards** применяются в первых строках каждого защищённого handler'а: `requireAuth` → `getWorkspaceForUserOrThrow` → `requireMinRole(role, ...)`. Папки `server/middleware/` нет — это осознанное решение в Phase 2 (см. [`../../06-system-architecture.md`](../../06-system-architecture.md)).
2. **Tenant-isolation через RLS + `withTenant`**. Любая операция, трогающая `tasks` / `task_events` / `boards` / `sprints`, обязательно идёт через `withTenant(workspaceId, tx)` — иначе RLS отрежет все строки.
3. **Транзакции охватывают изменение домена + audit-событие** (`task` + `task_events`). Если упадёт запись `task_events` — упадёт и основной INSERT.
4. **Events публикуются ПОСЛЕ commit'а** — никогда не публикуется «будущий» event, который может откатиться.
5. **In-process EventEmitter в Current** (single instance Nitro). Cross-node fan-out — Target.
6. **Min-data thresholds в аналитике**: продукт честно говорит «данных мало», а не выдаёт шум за сигнал.

## Не показаны (осознанные пропуски)

- **Error paths** в guards (401, 403) — очевидны по use case, ветвление сделало бы диаграммы громоздкими.
- **Login / logout / register** — типовые `nuxt-auth-utils` сценарии, отдельная sequence ничего не добавляет.
- **SSE reconnection logic** — обрабатывается на клиенте (`EventSource` авто-переподключается).
- **Детали payload'а events** — см. `BoardEvent` в [`../../../server/utils/events.ts`](../../../server/utils/events.ts).

## Связь с другими артефактами

- **Use case:** [`../01-use-case/`](../01-use-case/) — прецеденты, для которых построены sequence'ы.
- **Component diagram:** [`../04-component/`](../04-component/) — участники в виде компонентов.
- **Class (domain):** [`../02-class/`](../02-class/) — сущности (`Task`, `TaskEvent`).
- **System architecture:** [`../../06-system-architecture.md`](../../06-system-architecture.md) — Current/Target/Evolution для SSE, pg-boss, multi-replica.
- **Analytics design:** [`../../10-analytics-design.md`](../../10-analytics-design.md) — детали Monte Carlo, Little's Law, выбор bootstrap.
- **Non-functional:** [`../../11-non-functional.md`](../../11-non-functional.md) — auth, RBAC, multi-tenancy.
