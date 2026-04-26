# Scrumban Platform — Initial Design Spec

**Дата:** 2026-04-18
**Статус:** ⚠️ SUPERSEDED 2026-04-23 — заменён [`2026-04-23-nuxt-monorepo-pivot.md`](2026-04-23-nuxt-monorepo-pivot.md)
**Автор:** Даня Черкесов (магистерский дипломный проект)

> **⚠️ Этот документ — исторический.** Стек был пересмотрен: Go backend заменён на Nitro (Nuxt monorepo). Доменная модель, аналитика, методология, требования и большинство архитектурных принципов — без изменений. **Актуальная спека:** [`2026-04-23-nuxt-monorepo-pivot.md`](2026-04-23-nuxt-monorepo-pivot.md). Этот файл оставлен для git-истории и понимания эволюции проекта.

## Резюме

Это консолидированная спецификация проекта Scrumban — платформы управления задачами, построенной на гибриде Scrum и Kanban, ориентированной на русскоязычные IT-команды 30+ человек. Ядро дифференциации — углублённая аналитика потока работ (CFD, cycle time, scatter), вероятностное прогнозирование доставки (Monte Carlo) и обоснованные рекомендации по WIP-лимитам (Little's Law).

Спецификация оформлена в формате **Current / Target / Evolution**:
- **Current** — MVP за ~3 месяца, демонстрируемый на предзащите.
- **Target** — production-ready к защите (~9 месяцев).
- **Evolution** — путь между состояниями с триггерами.

## Контекст проекта

- **Разработчик:** solo (1 человек).
- **Срок защиты:** ~9 месяцев от даты создания этого документа.
- **Срок предзащиты (рабочий MVP):** ~3 месяца.
- **Текущая точка:** 2026-04-18, начало разработки.

## Зафиксированные решения

### Позиционирование и цели
- **Концепция:** Scrumban-платформа для русскоязычных IT-команд с углублённой аналитикой потока работ, Monte Carlo прогнозированием, Little's Law рекомендациями, интегрированная в РФ-экосистему.
- **Три столпа ценности:** B (process-aware analytics, ядро), B+ (statistical forecasting), E (РФ-интеграции).
- **Научная новизна:** применение статистических методов process mining и probabilistic forecasting к встроенной аналитике Scrumban-инструмента; эмпирическая оценка ограничений ML-подходов к задаче предсказания задержек.
- **Claim discipline:** «inspired by process mining approaches», не «process mining system».

Детали: [`../../01-vision-and-goals.md`](../../01-vision-and-goals.md).

### Целевая аудитория
- **Primary persona:** Scrum Master / Agile Coach / Delivery Manager.
- **Размер команд ЦА:** 30+ человек.
- **Рынок:** русскоязычные IT-компании, преимущественно в РФ и СНГ.

Детали: [`../../02-target-audience.md`](../../02-target-audience.md).

### Конкурентный анализ и ниша
- **Прямой конкурент:** Kaiten (РФ). Отличаемся вероятностной аналитикой и обоснованными рекомендациями.
- **Косвенные:** Yandex Tracker (избыточен для ЦА), Weeek, YouGile (не специализированы под Scrumban), Pyrus (BPM-фокус).
- **Ушедшие:** Jira, Trello — освободили российский рынок.

Детали: [`../../03-competitive-analysis.md`](../../03-competitive-analysis.md).

### Экономическое обоснование
- **Модель монетизации:** Open-core.
  - Free — до 10 пользователей, базовый функционал.
  - Pro — ~1500 ₽/пользователь/мес, полная аналитика + интеграции.
  - Enterprise — договорной, SSO/audit/on-prem/SLA.
- **Размер рынка:** глобально $8B (2026), CAGR ~10%; РФ ~13% Европы с активным импортозамещением.
- **Unit economics:** 1 Pro-клиент (команда 40 чел.) ≈ 60K ₽/мес MRR, LTV ≈ 1.44M ₽.
- **Себестоимость MVP:** ~1000 ₽/мес (Yandex Cloud VM).

Детали: [`../../04-economic-rationale.md`](../../04-economic-rationale.md).

### Technology stack
- **Frontend:** Nuxt 3 (SPA-mode, не SSR) + Vue 3 + Pinia + TypeScript strict + Tailwind + ECharts + vuedraggable + vue-query.
- **Backend:** Go 1.22+ + echo + pgx/v5 + sqlc + goose + slog + river.
- **БД:** PostgreSQL 16+ с включённым Row-Level Security.
- **API контракт:** OpenAPI → oapi-codegen (Go) + kubb (TS).
- **Real-time:** SSE (не WebSocket), Postgres LISTEN/NOTIFY для cross-node fan-out при scale-out.
- **Очереди:** river на Postgres (не Redis/Kafka в MVP).
- **Infra:** Docker Compose, Caddy reverse-proxy, GitHub Actions CI/CD, Yandex Cloud hosting.
- **Монорепо:** один git-репозиторий с папками `backend/` и `frontend/`.

### Модель развёртывания
- **Гибрид:** SaaS-first, on-premise capable с первого дня.
- **Архитектурные следствия:** контейнеризация, S3-совместимый storage, никакого cloud-specific lock-in.
- **MVP hosting:** одна VM на Yandex Cloud (~1000 ₽/мес).

Детали: [`../../12-deployment.md`](../../12-deployment.md).

### Архитектурные принципы (hard rules)
1. **Модульный монолит на Go.** Не микросервисы.
2. **Row-Level Security в Postgres** для multi-tenancy. `workspace_id` в каждой tenant-scoped таблице + composite индексы + RLS-политика + middleware `SET LOCAL app.workspace_id`.
3. **Event sourcing для аналитики.** Таблица `events` (append-only) + предрассчитанные агрегаты (`flow_daily`, `cycle_time_samples`, `sprint_stats`) + materialized views.
4. **SSE scale-out через Postgres LISTEN/NOTIFY.** В MVP (1 реплика) — in-process hub; при scale-out — fan-out через LISTEN/NOTIFY.
5. **Background jobs через river на Postgres.** Интерфейс `JobQueue` в коде → миграция на Redis/asynq позже, без изменения бизнес-логики.
6. **Feature flags с первого дня.** Любая новая фича за флагом.
7. **Nuxt в SPA-режиме.** `ssr: false`. Server routes — только как BFF (прокси-агрегация к Go API).
8. **Дисциплина импортов в Go.** `api → services → storage → domain`. Проверяется `go-arch-lint` в CI.
9. **Claim discipline в тексте.** «Inspired by process mining», не «process mining system». Язык соответствует реализации.
10. **Min-data thresholds для аналитики.** Не показываем перцентили при N<30, прогнозы при <3 спринтов. Продукт честно говорит «данных мало».

Детали: [`../../06-system-architecture.md`](../../06-system-architecture.md), [`../../11-non-functional.md`](../../11-non-functional.md).

### MVP scope (предзащита, ~3 мес)

#### MUST (ядро демо)
- Auth (email/password), workspace + приглашения, проекты, доски.
- Задачи, комментарии, drag-n-drop, RBAC (4 роли).
- Бэклог, спринты, story points, velocity, burndown.
- WIP-лимиты, cycle/lead time, **CFD**, throughput.
- **Дашборд процесса** с bottleneck detection и Monte Carlo прогнозом — гвоздь демо.

#### SHOULD (если успеваем)
- Файлы/вложения, scatter plot, сравнение спринтов, Telegram-бот, SSE.

#### LATER (месяцы 4–9)
- Кросс-командная аналитика, Little's Law рекомендации, percentile-based alerts.
- Интеграции (Pachca/VK Teams, GitFlic, импорт из Jira/Trello/Kaiten).
- Audit log, SSO, биллинг.
- **ML research extension** для главы в дипломе (не продуктовая фича).

Детали: [`../../05-mvp-scope-and-roadmap.md`](../../05-mvp-scope-and-roadmap.md).

## Progressive complexity — how it's taught

Проект учитывает, что автор учит Go с нуля одновременно с разработкой. Каждый технический документ использует формат Current/Target/Evolution, где:
- **Current** — минимальный набор концепций, понятный новичку в Go.
- **Target** — production-grade архитектура, к которой движемся.
- **Evolution** — триггеры, при которых переходим из Current в Target.

Архитектурные принципы (RLS, event sourcing, SSE fan-out) включаются **с первого дня** там, где стоимость их внедрения ≤10% общего времени; остальное отложено до появления реальной потребности.

Подробнее: [`../../08-backend-design.md`](../../08-backend-design.md) (phased approach для Go).

## Research extension — ML-эксперимент (LATER, не в продукт)

После 4–6 месяцев работы тестовых команд будет собран исторический dataset (задачи × переходы × метаданные). На нём проводится **исследовательский эксперимент**:

- Задача: обучить классификатор «задача с высоким риском задержки» (бинарная переменная: провела ли задача в in_progress+review более p75 исторического среднего).
- Модели: логистическая регрессия, XGBoost.
- Метрики: precision/recall, AUC-ROC, feature importance.
- **Ожидаемый и приемлемый результат:** модель показывает слабое качество на шумных данных малых выборок → это **подтверждает выбор в пользу статистических методов в продукте** и является честным академическим выводом.

Эксперимент **не** встраивается в продукт. Описывается в отдельной главе диплома.

Детали: [`../../10-analytics-design.md`](../../10-analytics-design.md), раздел «ML research extension».

## Критерии успеха

### Для предзащиты (месяц 3)
- Все MUST-фичи реализованы.
- Демо-сценарий воспроизводится end-to-end на staging.
- Monte Carlo прогноз даёт правдоподобные числа на sandbox-данных.
- CFD, throughput, cycle time работают с минимум 30 закрытых задач за 3 спринта.
- Docker Compose запускается на чистой машине.

### Для защиты (месяц 9)
- Target-state реализация по всем ключевым архитектурным документам.
- Research ML-эксперимент проведён и описан в тексте диплома.
- 3–5 тестовых команд используют продукт.
- Staging-инсталляция stable и готова к paying customers.
- Текст диплома соответствует реализации.

## Связи между документами

```
README.md (docs/)
    ├── 01-vision-and-goals.md      ── цели и позиционирование
    ├── 02-target-audience.md       ── ЦА, персоны, проблемы
    ├── 03-competitive-analysis.md  ── аналоги, ниша, SWOT
    ├── 04-economic-rationale.md    ── рынок, монетизация, unit economics
    ├── 05-mvp-scope-and-roadmap.md ── scope, фазы, критерии
    ├── 06-system-architecture.md   ── компоненты, потоки
    ├── 07-domain-model.md          ── сущности, схема БД
    ├── 08-backend-design.md        ── Go: структура, паттерны
    ├── 09-frontend-design.md       ── Nuxt: структура, стор
    ├── 10-analytics-design.md      ── B/B+, формулы, пороги
    ├── 11-non-functional.md        ── auth, RBAC, RLS, observability
    └── 12-deployment.md            ── Docker, CI/CD, мониторинг
```

## Открытые вопросы / будущие решения

Список того, что намеренно оставлено «на потом»:

1. **Выбор между echo и chi для HTTP-роутера.** Оба приемлемы; финальный выбор — в момент начала написания кода Фазы 1.
2. **OpenAPI-codegen: oapi-codegen vs альтернативы.** oapi-codegen — default, но проверим альтернативы (swag, ogen) на пробном endpoint'е.
3. **Выбор библиотеки UI-компонентов для Nuxt: shadcn-vue vs PrimeVue vs Nuxt UI.** Решение по результатам прототипа.
4. **Конкретный формат identity-провайдера для Enterprise.** OAuth2 vs SAML — решается при появлении первого Enterprise-клиента.
5. **Стратегия миграции с river на Redis asynq.** Описана концептуально, реализация — когда понадобится.

## Изменения и версионирование

- **v1 (2026-04-18):** начальная зафиксированная версия. Все ключевые решения утверждены в процессе brainstorming-сессии.
- Последующие изменения — через git-историю в соответствующих файлах `docs/`.
- Мажорные архитектурные изменения требуют обновления этого master spec'а.

## Итоговое утверждение

Эта спецификация описывает Scrumban-платформу как:

- **Академически защитимую** магистерскую работу с чётко сформулированной научной новизной и честно обозначенными границами применимости.
- **Реалистично выполнимую** одним разработчиком за 9 месяцев при условии прогрессивного освоения Go и дисциплины MVP-scope.
- **Product-ready-капабельную** — при успешном прохождении всех фаз продукт можно вывести на рынок с paying customers.

**Следующий шаг:** создание детального implementation plan для Фазы 0 (освоение Go) и Фазы 1 (MVP Foundation) через навык writing-plans.