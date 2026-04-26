# 10 — Analytics Design

## Обзор

Аналитический слой Scrumban-платформы — ядро дифференциатора продукта (позиционирование B + B+). Построен на принципах:

1. **Inspired by process mining approaches**, но не полноценный process mining (нет discovery-алгоритмов, нет conformance checking).
2. **Всё вычислимо и прозрачно.** Каждая цифра — формула. Каждая рекомендация — объяснение.
3. **Статистика, не ML.** ML-эксперимент — исследовательский приложение в тексте диплома, не продуктовая фича.
4. **Минимальные пороги данных** — продукт честно отвечает «данных пока мало», а не выдаёт шум за сигнал.
5. **Не считаем на лету из сырых данных.** Агрегаты и materialized views обеспечивают предсказуемую производительность.

## Источник данных: event-sourced модель

Основной ввод для аналитики — таблица `events` (см. `07-domain-model.md`).

Каждое изменение домена порождает событие:
- `task_created`, `task_moved_column`, `task_assigned`, `task_points_changed`, `task_closed`, `task_reopened`.
- `sprint_created`, `sprint_started`, `sprint_closed`.
- `column_wip_breached`.

Payload событий — jsonb, несёт контекст (например, `task_moved_column` содержит `from_column`, `to_column`, `duration_in_source_sec`).

## Агрегаты (предрассчитанные срезы)

### `flow_daily` — для CFD
Одна строка на `(workspace_id, project_id, date, column_id)` с счётчиками:
- `count_in` — сколько задач вошло в колонку за день.
- `count_out` — сколько вышло.
- `count_eod` — сколько осталось в колонке на конец дня.

Обновляется триггером на каждом `task_moved_column` или batch'ем раз в 15 мин (в зависимости от нагрузки).

### `cycle_time_samples` — для scatter и percentiles
Одна строка на каждый проход задачи через колонку:
- `task_id`, `column_id`, `column_role`
- `entered_at`, `exited_at`, `duration_seconds`

Заполняется при событии `task_moved_column`.

### `sprint_stats` — для velocity и итогов спринта
Агрегируется при `sprint_closed` и раз в час для активного спринта.

### Materialized views
- `mv_cfd_last_90d` — CFD за последние 90 дней (refresh ежечасно).
- `mv_throughput_weekly` — еженедельный throughput (refresh ежедневно).
- `mv_cycle_time_percentiles` — перцентили cycle time по column_role (refresh ежечасно).

## Метрики (B — ядро)

### Cumulative Flow Diagram (CFD)
Стековый график: ось X — дни, ось Y — количество задач, слои — колонки по `column_role` (backlog → in_progress → review → done).

**Польза:** видно «распирание» колонок (bottlenecks), скорость продвижения, зарождающиеся проблемы.

**Расчёт:** прямо из `flow_daily`. Задача frontend'а — красиво отрисовать.

**Минимум данных:** ≥7 дней работы проекта.

### Cycle time / Lead time
- **Cycle time:** время от входа задачи в `in_progress` до входа в `done`.
- **Lead time:** время от создания задачи до входа в `done`.

**Визуализация:**
- Scatter plot: X — дата завершения, Y — cycle time.
- Линии p50, p85, p95.

**Польза:** видно тренд (растёт/стабилен), выбросы (задачи-долгожители).

**Расчёт:** сумма `duration_seconds` по соответствующим `column_role` в `cycle_time_samples`.

**Минимум данных:** ≥30 закрытых задач для отображения перцентилей.

### Throughput
Количество задач, закрытых за период (неделя / спринт).

**Визуализация:** bar chart.

**Польза:** основа для Monte Carlo прогноза.

**Расчёт:** COUNT события `task_closed` за период, из `events` или `mv_throughput_weekly`.

### Bottleneck detection
Колонки, где задачи в среднем проводят дольше всего (по перцентилям cycle time в конкретной колонке).

**Визуализация:** тепловая карта или ранжированный список.

**Расчёт:** p85 duration_seconds по column_role из `cycle_time_samples`.

## Прогнозирование и рекомендации (B+)

### Monte Carlo прогноз доставки спринта

**Задача:** оценить вероятность закрытия N оставшихся задач за оставшееся время спринта.

**Алгоритм (упрощённо):**
1. Выбрать историю throughput (задач / неделю) за последние K недель (K≥3).
2. Для каждой симуляции (N=1000):
   - В каждый день цикла случайно сэмплировать throughput из истории.
   - Накапливать до тех пор, пока не закроется N задач.
   - Зафиксировать дату закрытия.
3. Собрать распределение дат закрытия.
4. Отчёт: P50, P85, P95, вероятность закрытия к планируемой дате.

**Реализация:**
- Go-пакет `internal/analytics/montecarlo.go`.
- Запускается on-demand при просмотре спринт-дашборда (результат кэшируется 15 мин).
- Или пересчитывается фоновым job'ом после каждого `task_closed` в активном спринте.

**Минимум данных:** ≥3 завершённых спринта или ≥20 закрытых задач за последние 4 недели.

**Формула (математически):**
Дневной throughput моделируется как эмпирическое распределение: D ~ Empirical(historical_daily_throughputs). Задачи-остаток: N. Сколько дней до закрытия? T = первое t, при котором sum(D_1..D_t) >= N. Распределение T строится симуляцией.

### Little's Law рекомендации по WIP

**Формула Литтла:** `WIP = throughput × cycle_time`.

**Применение:**
- Зная среднее throughput и cycle time команды → можно оценить «естественный» WIP.
- Если текущий WIP сильно выше — скорее всего создаются заторы (больше одновременной работы → больше context-switching → дольше каждая).
- Если текущий WIP сильно ниже — возможно, команда недогружена.

**UI:**
> «Little's Law: ваш throughput ≈ 10 задач/неделю, средний cycle time ≈ 3.5 дня. Оптимум WIP ≈ 5. Текущий лимит — 8. Возможно, стоит снизить до 5–6 и посмотреть на cycle time.»

**Минимум данных:** ≥3 недели работы с ≥20 закрытых задач.

### Percentile-based stuck-task alerts

Для каждой колонки (кроме terminal) собираем распределение cycle time (duration в конкретной колонке).

Задача «застряла», если её текущее время в колонке > p90 исторического распределения.

**UI:**
> «Задача SCB-42 в Review уже 4.5 дня — это дольше 90% задач за последние 30 дней. Проверь блокеры.»

**Минимум данных:** ≥30 проходов через данную колонку.

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

## Расчёты — где и когда

### В запросе (on-demand)
- CFD — из `flow_daily` (SELECT).
- Scatter + перцентили — из `cycle_time_samples` + `mv_cycle_time_percentiles` (SELECT).
- Throughput — из `mv_throughput_weekly`.

### Background jobs
- Обновление `flow_daily` после `task_moved_column` (trigger или 15-мин batch).
- Обновление `cycle_time_samples` при `task_moved_column` (trigger).
- Refresh materialized views по расписанию.
- Monte Carlo пересчёт для активных спринтов (1 раз в час).

### Кэширование
- Результаты Monte Carlo кэшируются в in-memory LRU на 15 мин.
- Лёгкие запросы (CFD, throughput) не кэшируются — быстрые из-за агрегатов.

## Производительность (target)

- CFD за 90 дней: <200ms (уровень БД запроса).
- Scatter за 30 дней (до 10K точек): <300ms.
- Monte Carlo 1000 симуляций на 50 задач: <500ms в Go.
- Refresh materialized views: <30 сек.

## Dual-track

### Current (MVP)
- События: минимальный набор типов.
- Агрегаты: `flow_daily` + `cycle_time_samples` + `sprint_stats`.
- Метрики в UI: CFD, throughput, базовый Monte Carlo (3 числа: P50/P85/P95).
- Thresholds работают (не показываем перцентили при N<30).

### Target
- Расширенные event types.
- Materialized views с автоматическим refresh.
- Little's Law рекомендации, percentile-based alerts.
- Сравнение спринтов, кросс-проектная аналитика.
- ML research completed (для диплома).

### Evolution
- Добавлять новые типы событий не требует миграций (jsonb payload).
- Partitioning больших таблиц (events, cycle_time_samples) когда >50M строк.
- Analytics-worker в отдельный процесс при появлении OLTP-задержек.

## Связанные документы
- [`07-domain-model.md`](07-domain-model.md) — event/aggregate схема
- [`08-backend-design.md`](08-backend-design.md) — internal/analytics пакет
- [`09-frontend-design.md`](09-frontend-design.md) — визуализация