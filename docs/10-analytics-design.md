# 10 — Analytics Design

## Обзор

Аналитический слой Scrumban-платформы — ядро дифференциатора продукта (позиционирование B + B+). Построен на принципах:

1. **Inspired by process mining approaches**, но не полноценный process mining (нет discovery-алгоритмов, нет conformance checking).
2. **Всё вычислимо и прозрачно.** Каждая цифра — формула. Каждая рекомендация — объяснение.
3. **Статистика, не ML.** ML-эксперимент — исследовательское приложение в тексте диплома, не продуктовая фича.
4. **Минимальные пороги данных.** Продукт честно отвечает «данных пока мало», а не выдаёт шум за сигнал.
5. **Live SQL в Current, агрегаты по триггеру.** Сегодня все метрики считаются прямым SELECT из `task_events`; материализованные представления и фоновое обновление — Target, вводятся при измеримом росте latency.

## Источник данных: event-sourced модель

Основной ввод для аналитики — таблица `task_events` (см. [`07-domain-model.md`](07-domain-model.md) → `task_events`). Append-only журнал движений задач.

Реализованные типы событий (enum `task_event_type` в [`server/db/schema/tasks.ts`](../server/db/schema/tasks.ts)):
- `task_created`, `task_moved`, `task_closed`, `task_reopened`, `task_assigned`, `task_updated`, `task_archived`.

Каждое событие несёт `from_column_id` / `to_column_id` (оба nullable — заполняются для `task_moved`), `task_id`, `actor_user_id`, `created_at`. Sprint-уровневые события (`sprint_started`, `sprint_closed`) и `column_wip_breached` — Target (см. ниже).

## Реализованные эндпойнты

Пять реализованных эндпойнтов, все в [`server/services/analytics.service.ts`](../server/services/analytics.service.ts), все live-SQL поверх `task_events` без агрегатов и кэшей:

| Метрика | Функция | Endpoint |
|---|---|---|
| Throughput | `computeThroughput` | `GET /api/workspaces/[id]/boards/[boardId]/analytics/throughput` |
| Cycle time | `computeCycleTime` | `GET /api/workspaces/[id]/boards/[boardId]/analytics/cycle-time` |
| CFD | `computeCFD` | `GET /api/workspaces/[id]/boards/[boardId]/analytics/cfd` |
| Monte Carlo | `computeMonteCarlo` | `GET /api/workspaces/[id]/boards/[boardId]/analytics/monte-carlo` |
| WIP recommendations | `computeWipRecommendations` | `GET /api/workspaces/[id]/boards/[boardId]/analytics/wip-recommendations` |

Все эндпойнты RBAC-защищены минимум `viewer` (через `requireMinRole`) и обёрнуты `withTenant(workspaceId, ...)` — RLS-политики Postgres гарантируют изоляцию tenant'ов на уровне БД.

> **RLS-покрытие.** RLS на 6 таблицах из 9: `boards`, `board_columns`, `tasks`, `task_events`, `sprints`, `sprint_tasks`. `users` — глобальная (не tenant-scoped). `workspaces` и `workspace_members` пока без RLS — известное отставание (см. [`11-non-functional.md`](11-non-functional.md)).

## Cumulative Flow Diagram (CFD)

Стековый график: ось X — дни, ось Y — количество задач, слои — колонки доски в порядке `position`.

**Польза:** видно «распирание» колонок (bottlenecks), скорость продвижения, зарождающиеся проблемы.

**Алгоритм (математически):** для каждого дня `d` в `[from, to]` вычисляется снимок «в каждой колонке на конец дня сидит N задач». Реализуется проигрыванием `task_events` в хронологическом порядке: для каждой задачи поддерживается «последняя известная колонка» (`taskColumn` Map), на границе суток снимается срез по колонкам.

### Current

Реализация: функция `computeCFD` в [`server/services/analytics.service.ts`](../server/services/analytics.service.ts).

- Один SELECT тянет все события `task_events` доски с `to_column_id IS NOT NULL`, отсортированные по `created_at, id ASC`.
- Дополнительный SELECT тянет колонки доски (`board_columns`).
- Свёртка событий и снимки по дням делаются in-memory в Node.js — без агрегатной таблицы.
- Удалённые задачи теряют события (FK cascade) и потому отсутствуют на графике — намеренное упрощение MVP, зафиксировано в комментарии к `computeCFD`.

**Пороги данных.** Жёсткого порога нет; при пустой истории график — пустой, без фантомных значений.

### Target: `mv_cfd_last_90d`

Materialized view с CFD за последние 90 дней, refresh hourly. Сегодня `flow_daily` / агрегаты не нужны — на ранних объёмах full scan индекса `(workspace_id, created_at)` укладывается в десятки миллисекунд.

> **Триггер ввода:** p95 latency `/api/.../analytics/*` > 500 мс при ≥ 100 закрытых задач/мес. Триггер совпадает с [`07-domain-model.md`](07-domain-model.md) → Target → `flow_daily` / `mv_cfd_last_90d` и [`06-system-architecture.md`](06-system-architecture.md) → Target → Aggregator service.

## Throughput

Количество задач, закрытых за период (день / неделя). База для Monte Carlo и Little's Law.

**Алгоритм:** `COUNT(*)` событий `task_closed` сгруппированных через `date_trunc(period, created_at)`, где `period ∈ {'day', 'week'}`.

### Current

Реализация: функция `computeThroughput` в [`server/services/analytics.service.ts`](../server/services/analytics.service.ts).

- Один SQL: `JOIN task_events × tasks` с фильтрами `event_type = 'task_closed'`, `board_id`, окно `[from, to]`, `GROUP BY date_trunc(period, created_at)`.
- Возвращает массив `{ bucket, count }`. Для дней без закрытий ничего не возвращается — расширение нулями делает `expandWithZeros` уже на стороне Monte Carlo (см. ниже).

**Пороги данных.** Если за окно `totalClosed === 0`, возвращается пустой массив; UI показывает пустой график без линий тренда.

### Target: `mv_throughput_weekly`

Materialized view с еженедельным throughput, refresh daily.

> **Триггер ввода:** p95 latency `/api/.../analytics/*` > 500 мс при ≥ 100 закрытых задач/мес.

## Cycle Time

Время от создания задачи до её закрытия — основа scatter-графика и перцентилей p50 / p85 / p95.

**Алгоритм:** для каждого `task_closed` в окне находится первое событие `task_created` той же задачи (с fallback на `tasks.created_at`, если в `task_events` нет `task_created` — legacy data); cycle time = разница в часах.

**Замечание о семантике.** Сегодня измеряется именно lead time (создание → закрытие), а не «классический» cycle time (вход в `in_progress` → закрытие). Точное «классическое» определение требует таблицы `cycle_time_samples` — Target.

### Current

Реализация: функция `computeCycleTime` в [`server/services/analytics.service.ts`](../server/services/analytics.service.ts).

- Один SQL: CTE `closed` (события `task_closed` доски в окне), CTE `created` (`DISTINCT ON (task_id)` первое событие `task_created`), JOIN, `EXTRACT(EPOCH ...) / 3600` для часов.
- Перцентили считаются на стороне Node.js функцией `percentile` (linear interpolation, NumPy «type 7»).

**Порог данных.** Константа `MIN_SAMPLES_FOR_PERCENTILES = 5`: если закрытых задач в окне меньше пяти, поля `meanHours` / `p50Hours` / `p85Hours` / `p95Hours` возвращаются как `null`. UI отображает «недостаточно данных» вместо фантомных значений на 1–2 точках. Это — материализация принципа «honesty over hype» в коде.

### Target: `mv_cycle_time_percentiles`

Materialized view с перцентилями cycle time по `column_role`, refresh hourly.

> **Триггер ввода:** p95 latency `/api/.../analytics/*` > 500 мс при ≥ 100 закрытых задач/мес.

### Target: bottleneck detection через `cycle_time_samples`

Колонки, где задачи в среднем проводят дольше всего (по p85 `duration_seconds` per `column_role`). Требует таблицы `cycle_time_samples` (один ряд на проход задачи через колонку с `entered_at` / `exited_at`) — её определение в [`07-domain-model.md`](07-domain-model.md) → Target → `cycle_time_samples`.

> **Триггер ввода:** появление таблицы `cycle_time_samples` с накопленными ≥ 30 проходами per board (статистическая значимость p85). Сегодня таблицы нет — bottleneck detection невозможна.

## Monte Carlo прогноз доставки

**Задача:** оценить вероятность закрытия N оставшихся задач за H дней спринта.

**Алгоритм (математически):**
1. Дневной throughput моделируется как эмпирическое распределение: `D ~ Empirical(historical_daily_throughputs)` — вектор за последние 90 дней с расширением нулями для дней без закрытий.
2. Для каждой из 1000 итераций: `H` раз сэмплируется день `d_i ~ D` (with replacement), `total += d_i`; цикл рвётся, как только `total ≥ N`.
3. Вероятность = доля итераций, где `total ≥ N` за ≤ H дней.
4. Перцентили `completionDays` (P50 / P85 / P95) — сколько дней ушло на накопление N (с верхней границей H+1 для тех, кто не уложился).

**Зачем нужен `expandWithZeros`.** Если оставить только дни с закрытиями, исторический throughput смещён вверх (модель «никогда не бывает нуля»). Включение нулевых дней даёт честную оценку «они иногда ничего не релизят».

### Current

Реализация: функция `computeMonteCarlo` в [`server/services/analytics.service.ts`](../server/services/analytics.service.ts).

- **Lookback:** `HISTORY_LOOKBACK_DAYS = 90`. Внутри переиспользуется `computeThroughput(period: 'day')` за это окно, потом `expandWithZeros` достраивает вектор до длины 90.
- **Итерации:** `DEFAULT_ITERATIONS = 1000`, query-параметр `iterations` зажат в `[100, 10_000]`.
- **Параметры:** `tasksRemaining` (от 0 до 1000), `horizonDays` (от 1 до 180) — приходят из query string. **Не из спринта и не из БД** — caller передаёт явно. Это упрощает контракт (один эндпойнт работает для любого «осталось N — успеем за H?» сценария) и делает функцию идемпотентной по входу.
- **Пороги данных:** `MIN_DAYS_OF_HISTORY = 14` (вектор throughput должен покрыть ≥ 14 дней) и `totalClosed > 0` (за 90 дней должно быть закрыто хотя бы одно задание). Иначе возвращается `{ ok: false, reason: 'insufficient_data', sampleDays, requiredDays: 14 }` — UI не получает «вероятность 0%», полученную из шума.
- **Кэша нет.** Замер локально: 50–150 мс на 1000 итераций при 90-дневной истории — кэш и фоновый пересчёт преждевременны.

**Эндпойнт:** `GET /api/workspaces/[id]/boards/[boardId]/analytics/monte-carlo?tasksRemaining=N&horizonDays=H&iterations=I`. Валидация query — через zod в [`server/api/workspaces/[id]/boards/[boardId]/analytics/monte-carlo.get.ts`](../server/api/workspaces/[id]/boards/[boardId]/analytics/monte-carlo.get.ts).

### Target: forecast cache

In-memory LRU с ключом `(workspaceId, boardId, tasksRemaining, horizonDays, iterations)` и TTL 15 мин.

> **Триггер ввода:** p95 latency `/api/.../analytics/monte-carlo` > 1,5 с. Сегодня — 50–150 мс, кэш не нужен.

### Target: фоновый пересчёт после `task_closed`

Фоновый job пересчитывает Monte Carlo для активного спринта при каждом `task_closed` и складывает результат в кэш.

> **Триггер ввода:** появление pg-boss workers (см. [`06-system-architecture.md`](06-system-architecture.md) → Target → pg-boss workers) **и** ≥ 50 одновременных активных спринтов в системе. До этого on-demand расчёт перекрывает все потребности.

### Target: пороги уровня sprint

Альтернативный/дополнительный порог: «нужно ≥ 3 завершённых спринта или ≥ 20 закрытых задач за последние 4 недели». Сегодня заменён более простым `MIN_DAYS_OF_HISTORY = 14` + `totalClosed > 0`, потому что sprint-агрегатов в БД пока нет.

> **Триггер ввода:** появление таблицы `sprint_stats` (см. [`07-domain-model.md`](07-domain-model.md) → Target → `sprint_stats`) с агрегированной velocity. Тогда Monte Carlo сможет требовать sprint-history minimum, а не только day-history.

## Little's Law рекомендации по WIP

**Формула Литтла:** `L = λ × W` (WIP = throughput × cycle time).

**Применение:**
- Зная средний throughput и cycle time команды → можно оценить «естественный» WIP.
- Если текущий WIP сильно выше — скорее всего создаются заторы (больше одновременной работы → больше context-switching → дольше каждая).
- Если текущий WIP сильно ниже — возможно, команда недогружена.

**UI (заметка для frontend):**

> «Little's Law: ваш throughput ≈ 10 задач/неделю, средний cycle time ≈ 3,5 дня. Оптимум WIP ≈ 5. Текущий лимит — 8. Возможно, стоит снизить до 5–6 и посмотреть на cycle time.»

### Current

Реализация: функция `computeWipRecommendations` в [`server/services/analytics.service.ts`](../server/services/analytics.service.ts).

- **Lookback:** `RECO_LOOKBACK_DAYS = 30` дней.
- Внутри переиспользуется `computeCycleTime` для тех же 30 дней.
- `throughputPerDay = closedCount / 30`. `meanCycleTimeDays = meanHours / 24`. `balancedWip = throughputPerDay × meanCycleTimeDays`.
- Балансная WIP делится поровну между «активными» колонками (`column_role ∈ {in_progress, review}`) — `backlog` и `done` не лимитируют поток. Per-column proportional split — Phase 4 задача (нужны per-column cycle times).
- Возвращается список `{ columnId, currentWipLimit, currentTaskCount, recommendedWip }` — UI показывает рядом с настроенным лимитом, чтобы Scrum-мастер мог решить.
- **Порог данных:** `RECO_MIN_SAMPLES = 5` закрытых задач за 30 дней. Иначе `{ ok: false, reason: 'insufficient_data', sampleSize, requiredSamples: 5 }`.

**Природа метрики.** Рекомендация описательная («данные предполагают N»), не предписывающая. Кэш / фоновый пересчёт здесь не нужны — расчёт лёгкий, переиспользует уже-кэшируемые на уровне Postgres страницы.

## Percentile-based stuck-task alerts

Для каждой колонки (кроме terminal) собирается распределение времени задач в этой колонке. Задача «застряла», если её текущее время в колонке > p95 исторического распределения.

**UI:**

> «Задача SCB-42 в Review уже 4,5 дня — это дольше 95% задач за последние 30 дней. Проверь блокеры.»

### Current

**Не реализовано.** Сегодня нет данных «время задачи в колонке X» — `task_moved` фиксирует только `from_column_id` / `to_column_id` / `created_at`, без `duration_seconds`-колонки. Чтобы корректно посчитать перцентиль на уровне колонки, нужна таблица `cycle_time_samples` или эквивалентный преагрегат.

### Target: percentile alerts через `cycle_time_samples`

> **Триггер ввода:** появление таблицы `cycle_time_samples` (см. [`07-domain-model.md`](07-domain-model.md) → Target → `cycle_time_samples`) с накопленными ≥ 30 проходами per board per column (статистическая значимость p95). Тот же триггер, что и для bottleneck detection.

## ML research extension (LATER, для главы в дипломе)

**Намеренно не product feature.** Цель — обогатить текст диплома оценкой применимости ML-подходов в этой предметной области.

**Эксперимент:**
1. Собрать данные с реальных команд за 2–3 месяца работы.
2. Feature engineering: признаки задачи (type, priority, story points, tags, исполнитель, проект, возраст, число перемещений, число комментариев).
3. Target: бинарная переменная «задача провела в `in_progress` + `review` более p75 среднего».
4. Модели: логистическая регрессия, XGBoost.
5. Метрики: precision/recall, AUC-ROC, feature importance.
6. Честная интерпретация: ожидается, что на малых-средних выборках модель покажет низкое качество → это **подтверждает выбор в пользу статистических методов в продукте**.

**Публикация:** отдельная глава в дипломе «Эмпирическая оценка ML-подходов к предсказанию задержек задач».

## Производительность

### Current (замерено локально)

- CFD за 30 дней: десятки миллисекунд (один SELECT + in-memory свёртка).
- Throughput / cycle time за 30 дней: десятки миллисекунд (один SQL).
- Monte Carlo 1000 итераций при 90 днях истории: 50–150 мс.
- WIP recommendations: десятки миллисекунд (переиспользует cycle-time SQL).

### Target: цели после введения агрегатов / кэша

- CFD за 90 дней (`mv_cfd_last_90d`): < 50 мс на 1k закрытых задач.
- Monte Carlo с кэшем: < 10 мс на cache hit, ≤ 1,5 с на miss (тот же триггер вводит кэш).

## Dual-track summary

### Current

- Live SQL поверх `task_events` для всех пяти метрик (CFD, throughput, cycle time, Monte Carlo, WIP recommendations).
- Реализованные event types: `task_created`, `task_moved`, `task_closed`, `task_reopened`, `task_assigned`, `task_updated`, `task_archived`.
- Пороги данных встроены в функции: `MIN_SAMPLES_FOR_PERCENTILES = 5` (cycle time), `MIN_DAYS_OF_HISTORY = 14` + `totalClosed > 0` (Monte Carlo), `RECO_MIN_SAMPLES = 5` (WIP recommendations).
- Никаких materialized views, никакого кэша, никакого фонового пересчёта.

### Target: расширения и оптимизации

- Sprint-уровневые события (`sprint_started`, `sprint_closed`) и `column_wip_breached` — см. [`07-domain-model.md`](07-domain-model.md) → Target.
- Агрегатные таблицы `flow_daily`, `cycle_time_samples`, `sprint_stats` — там же.
- Materialized views `mv_cfd_last_90d`, `mv_throughput_weekly`, `mv_cycle_time_percentiles` — все по триггеру p95 latency `/api/.../analytics/*` > 500 мс при ≥ 100 закрытых задач/мес.
- Forecast cache (LRU, 15 мин TTL) — триггер: Monte Carlo p95 > 1,5 с.
- Фоновый Monte Carlo пересчёт через pg-boss — триггер: pg-boss workers + ≥ 50 одновременных активных спринтов.
- Bottleneck detection (p85 по `column_role`) и percentile-based stuck-task alerts (p95) — оба через `cycle_time_samples` с ≥ 30 проходами per board.
- ML research completed (для главы в дипломе).

### Evolution

- Расширение event types — без миграций (нумерованный enum + `payload jsonb`-расширение).
- Partitioning `task_events` / `cycle_time_samples` — когда таблица перевалит за 50M строк.
- Aggregator service в отдельный процесс — при появлении OLTP-задержек на write path после введения триггеров на агрегаты.

## Связанные документы

- [`07-domain-model.md`](07-domain-model.md) — схема `task_events` и Target-таблиц `flow_daily` / `cycle_time_samples` / `sprint_stats`.
- [`08-backend-design.md`](08-backend-design.md) — структура `server/services/`, контракт RBAC, обёртка `withTenant`.
- [`09-frontend-design.md`](09-frontend-design.md) — визуализация (ECharts: stacked area для CFD, scatter для cycle time, bar для throughput).
- [`06-system-architecture.md`](06-system-architecture.md) — место аналитики в общей архитектуре, Aggregator service в Target.
- [`11-non-functional.md`](11-non-functional.md) — производительность, RLS-покрытие.
