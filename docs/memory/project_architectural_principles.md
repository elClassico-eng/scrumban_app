---
name: Scrumban architectural principles (from design review 2026-04-18)
description: Hard rules for the Scrumban codebase revealed by production-grade critique — apply to every feature
type: project
originSessionId: 4d07de0a-84f0-4563-b2b7-e26a2bcc8a82
---
Принципы, которые должны соблюдаться в коде Scrumban-платформы. Выведены из критики дизайна 2026-04-18.

**Multi-tenancy (безопасность данных):**
- ВСЕ таблицы с tenant-scope содержат `workspace_id NOT NULL`.
- Все composite-индексы начинаются с `workspace_id`: `(workspace_id, …)`.
- Service-layer запрещает запросы без tenant-scope (строгое правило в handlers и repos).
- Включить **Row-Level Security** в PostgreSQL (`CREATE POLICY ... USING (workspace_id = current_setting('app.workspace_id')::uuid)`) — это hard guard от забытого WHERE. Работает автоматически на каждый запрос.

**Real-time (SSE) при scale-out:**
- Один инстанс: SSE достаточно без пабсаба.
- Два+ инстанса: нужен pub/sub (Postgres LISTEN/NOTIFY пока хватает; когда перестанет — Redis Pub/Sub).
- В MVP: sticky-sessions на уровне балансера до тех пор, пока инстанс один.

**Analytics (B и B+):**
- НЕ считать метрики на лету из сырых данных. Это путь к торможению.
- Подход: event-sourced + precomputed aggregates.
  - Логируем события (`task_moved`, `task_closed`, `wip_breach`) в `events`-таблицу.
  - Дневные/часовые агрегации обновляются incrementally через job'ы или триггеры.
  - CFD, throughput, cycle time строятся из агрегатов, не из JOIN'ов сырых задач.
- Materialized views для тяжёлых read-моделей; refresh по расписанию.
- Min-data thresholds: не показываем перцентили при N<30 и прогнозы при <3 спринтов.

**Frontend (Nuxt 4):**
- Режим — SPA (`ssr: false`), не полный SSR. Продукт авторизованный, SSR не даёт пользы.
- `server/api/*` (Nitro routes) — это и есть backend (не отдельный сервис). Frontend и backend в одном Node-процессе.

**Event model:**
- Изменения домена → порождают события → события → аналитика и интеграции.
- Не состояния, а переходы. Это даёт пересчёт и auditability.

**Feature flags:**
- Любая новая фича под флагом (минимум env-var или DB row).
- На демо/предзащите — возможность выключить сырую фичу за 1 секунду.

**Background jobs:**
- MVP: pg-boss на Postgres (в том же Nitro-процессе).
- Миграция на отдельный worker-процесс — когда фоновых задач становится много и они мешают API-запросам. Заранее НЕ делаем.

**Integrations:**
- В MVP: только demo-level. 1 рабочий бот (Telegram или Pachca) + 1 webhook direction.
- Глубокие интеграции (1С, Bitrix24) — LATER.

**Главный принцип:** «строим систему, которую успеем сделать», а не «систему, которую можно бесконечно масштабировать». При выборе — в пользу простоты и скорости.
