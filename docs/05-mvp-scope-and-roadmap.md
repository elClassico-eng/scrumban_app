# 05 — MVP Scope & Roadmap

## Scope MVP (к предзащите, месяц 3)

Цель демо: показать работоспособный Scrumban-инструмент с уникальным ядром аналитики. История демо: «вот доска и спринты — стандарт; а вот наша фишка — дашборд процесса с CFD, throughput, Monte Carlo прогнозом и Little's Law рекомендациями».

### MUST (без этого MVP не имеет смысла)

#### Базовая работа
1. Email/password аутентификация (scrypt через `nuxt-auth-utils`, signed HTTP-only cookie).
2. Создание/управление workspace; добавление участников через RBAC API.
3. Доска с drag-n-drop колонок и задач.
4. Задачи: title, description, assignee, priority, status (=колонка).
5. Базовый RBAC: 5 ролей (`viewer < member < scrum_master < admin < owner`).

#### Scrum-часть
6. Спринты: CRUD, state machine `planned → active → closed/cancelled`.
7. Связь задач со спринтами (`sprint_tasks` join).

#### Kanban + B-ядро (наш дифференциатор)
8. WIP-лимиты на колонках (hard, с `force=true` override).
9. **Cumulative Flow Diagram (CFD) — главный визуал демо.**
10. Throughput chart.
11. Cycle time (сейчас lead-time semantic, `task_created → task_closed`).
12. Monte Carlo bootstrap-прогноз (1000 итераций, дневной throughput за 90 дней).
13. Little's Law рекомендации по WIP.

### SHOULD (если успеваем)
- SSE live-обновление доски (✅ in-process EventEmitter, реализовано в Phase 2).
- Burndown chart, story points, velocity.
- Файлы/вложения к задачам (Object Storage).
- Telegram-бот для уведомлений.

### LATER (месяцы 4–9 до защиты)

См. подробности в Target-секциях каждого `0X-*.md` дока. Ключевые блоки:

#### B+ развитие
- Кросс-командная (multi-project) аналитика.
- Percentile-based alerts на застрявшие задачи.
- Scatter plot cycle time с percentile-разметкой.

#### Research extension
- Сбор исторических данных из тестовых команд.
- Эксперимент: XGBoost / логистическая регрессия на задаче «task will be delayed».
- Публикация методологии и результатов в тексте диплома (research scope, не product feature).

#### E (интеграции)
- Webhook'и (универсально, через pg-boss + worker dispatch).
- Pachca/VK Teams бот.
- GitFlic/GitVerse привязка коммитов к задачам.
- Импорт из Jira/Trello/Kaiten.

#### Enterprise
- Audit log (`audit_log` table, retention 7 лет).
- SSO (Yandex ID / GitFlic ID OAuth, SAML), 2FA, WebAuthn / Passkeys.
- Биллинг (ЮKassa / CloudPayments) с тарифами.
- On-prem deploy pack.

## Явно исключено из scope

| Исключение | Причина |
|------------|---------|
| Кастомные поля на задачах | Переусложнение; закрывается только enterprise-уровнем |
| Множественные доски в одном проекте | Усложняет UX; в MVP нет проектов вообще, только workspace → boards |
| Sub-tasks / checklists | Переусложнение доменной модели |
| Epic → Story → Task иерархия | MVP: плоские задачи с полем priority |
| Time tracking (журнал времени) | Только estimate; реальные часы — LATER |
| Нативные мобильные приложения | Адаптивный web-UX в MVP |
| Полный process mining (discovery, conformance) | Вне scope диплома и продукта; используем «inspired by flow analytics» подход |
| Multi-language UI | RU+EN в LATER |

## Roadmap по фазам

## Phase 0 (пропущена)

> **Решение от 2026-04-26:** pet-project Phase 0 для освоения TS-backend пропущен. User имеет уверенный TS-фон (Nuxt/Vue), реализация началась сразу с Phase 1 (RLS-foundation для Scrumban).
> **Сохранённый план:** [`docs/archive/2026-04-23-phase0-week1-nitro-starter.md`](archive/2026-04-23-phase0-week1-nitro-starter.md) — историческая справка, материал для главы «Эволюция архитектуры» в магистерской работе.

## Phase 1 — RLS Foundation ✅ Завершена

- Postgres 16 + Drizzle ORM setup; миграции через SQL-файлы в [`drizzle/migrations/`](../drizzle/migrations/).
- 9 таблиц схемы: `users`, `workspaces`, `workspace_members`, `boards`, `board_columns`, `tasks`, `task_events`, `sprints`, `sprint_tasks`.
- Row-Level Security на 6 таблицах из 9 (`boards`, `board_columns`, `tasks`, `task_events`, `sprints`, `sprint_tasks`); `users` — глобальная, `workspaces` и `workspace_members` — известное отставание (см. [`07-domain-model.md`](07-domain-model.md), [`11-non-functional.md`](11-non-functional.md)).
- Two-role Postgres setup: `scrumban` (миграции, минует RLS) и `scrumban_app` (рантайм, FORCE RLS).
- `withTenant()` helper через `set_config('app.workspace_id', $1, true)` — единственный путь к данным (см. [`server/utils/db.ts`](../server/utils/db.ts)).
- Auth: email/пароль через `nuxt-auth-utils` (scrypt по умолчанию, signed HTTP-only cookie).
- 5 RBAC ролей: `viewer < member < scrum_master < admin < owner` (см. [`docs/uml/01-use-case/roles-guide.md`](uml/01-use-case/roles-guide.md)).
- RLS integration tests в [`tests/`](../tests/): cross-tenant access возвращает 0 строк.

### Что **не** сделано в Phase 1 (перенесено в Target)

- ~~`invitations` table + magic-link приглашения~~ → Target (триггер: первая публичная регистрация / появление ≥ 2 одновременных команд). См. [`07-domain-model.md`](07-domain-model.md) → Target → invitations.
- ~~Восстановление пароля по email~~ → Target (триггер: первый публичный регистр). См. [`11-non-functional.md`](11-non-functional.md) → Target.
- ~~`sessions` table + revoke API~~ → Target (триггер: первая необходимость глобального revoke). См. [`07-domain-model.md`](07-domain-model.md) → Target → sessions.
- ~~RLS на `workspaces` + `workspace_members`~~ → Target (известное отставание; trigger: первый клиент с >1 workspace где данные пересекаются на этих таблицах).

## Phase 2 — Core Domain + Real-time ✅ Завершена

- Boards + columns CRUD с reorder через парковку (offset 10000).
- Tasks lifecycle (state machine в [`server/services/tasks.service.ts`](../server/services/tasks.service.ts)): корректная обработка `closedAt` / `reopenedCount`. Reopen считается только если task был реально закрыт.
- WIP enforcement (hard, с `force=true` override) на cross-column moves.
- RBAC через [`server/utils/rbac.ts`](../server/utils/rbac.ts): `roleAtLeast`, `requireMinRole`, `strictlyOutranks`, «last owner» guard.
- Domain errors: `NotFoundError`, `ForbiddenError`, `ConflictError`, `ValidationError`, `UnauthorizedError` + `toHttpError` mapping (см. [`server/utils/errors.ts`](../server/utils/errors.ts)).
- SSE real-time updates: in-process EventEmitter (`server/utils/events.ts`) → SSE клиентам board'а.
- ~44 HTTP endpoint'а в [`server/api/`](../server/api/).
- 124 теста зелёных (vitest + testcontainers + Postgres).

### Что **не** сделано в Phase 2 (перенесено в Target)

- ~~`projects` entity + cross-board grouping~~ → Target (триггер: ≥ 3 активных досок в workspace одновременно или прямой user-request). См. [`07-domain-model.md`](07-domain-model.md) → Target → projects.
- ~~`task_comments`~~ → Target (триггер: ≥ 5 активных пользователей с пересекающимися назначениями за rolling 7 дней). См. [`07-domain-model.md`](07-domain-model.md) → Target → task_comments.
- ~~`task_attachments`, `task_tags`~~ → Target (см. [`07-domain-model.md`](07-domain-model.md) → Target).
- ~~RBAC middleware extraction (`server/middleware/rbac.ts`)~~ → Target (триггер: ≥ 30 endpoint'ов с одинаковым guard'ом). См. [`08-backend-design.md`](08-backend-design.md) → Target.
- ~~Cross-node SSE через LISTEN/NOTIFY~~ → Target (триггер: появление 2-й реплики Nitro). См. [`06-system-architecture.md`](06-system-architecture.md) → Target.

## Phase 3 — Sprints + Analytics ✅ Завершена

- Sprints state machine (`planned → active → closed/cancelled`) в [`server/services/sprints.service.ts`](../server/services/sprints.service.ts); партиальный unique index `WHERE state = 'active'` гарантирует «один активный спринт на доску».
- `sprint_tasks` join table (M:N задачи ↔ спринты).
- `task_events` лог: 7 типов (`task_created`, `task_moved`, `task_closed`, `task_reopened`, `task_assigned`, `task_updated`, `task_archived`) — специализированный, не универсальный (см. [`07-domain-model.md`](07-domain-model.md) → events решение).
- Аналитика на task_events (live-SQL, без MV, без кэша) в [`server/services/analytics.service.ts`](../server/services/analytics.service.ts):
  - **Throughput** (rolling).
  - **Cycle time** (сейчас lead-time semantic, `task_created → task_closed`; strict cycle time — Target, см. [`10-analytics-design.md`](10-analytics-design.md)).
  - **CFD** (Cumulative Flow Diagram) за 90 дней.
  - **Monte Carlo bootstrap** (1000 итераций, дневной throughput за 90 дней с `expandWithZeros` для дней без закрытий, пороги `MIN_DAYS_OF_HISTORY = 14` и `totalClosed > 0`).
  - **Little's Law рекомендации** (WIP = Throughput × Cycle Time).
- 5 analytics endpoints под `/api/workspaces/[id]/boards/[boardId]/analytics/`.

### Что **не** сделано в Phase 3 (перенесено в Target)

- ~~`flow_daily` aggregate + триггеры~~ → Target (триггер: p95 latency `/api/.../analytics/*` > 500 мс при ≥ 100 закрытых задач/мес). См. [`07-domain-model.md`](07-domain-model.md) → Target → flow_daily.
- ~~Materialized views (`mv_cfd_last_90d`, `mv_throughput_weekly`, `mv_cycle_time_percentiles`)~~ → Target (тот же триггер). См. [`10-analytics-design.md`](10-analytics-design.md) → Target.
- ~~Sprint events (`sprint_started`, `sprint_closed`, `sprint_cancelled`) в task_events~~ → Target (триггер: дашборд активности команды на уровне спринтов). См. [`10-analytics-design.md`](10-analytics-design.md) → Target.
- ~~Burndown chart, story points, velocity~~ → Target Phase 4+ (триггер: команда ≥ 5 человек, использующих Scrum-составляющую с оценкой задач).
- ~~Forecast cache (LRU 15 мин)~~ → Target (триггер: Monte Carlo p95 > 1,5 с — сейчас 50–150 мс).
- ~~`cycle_time_samples` table + bottleneck detection p85~~ → Target (триггер: ≥ 30 проходов per board per column для статистической значимости). См. [`07-domain-model.md`](07-domain-model.md) → Target.
- ~~Percentile-based stuck-task alerts~~ → Target (тот же триггер).

## Phase 4 — Frontend MVP (предстоит)

> **Триггер старта:** план [`docs/superpowers/plans/2026-05-10-docs-code-sync.md`](superpowers/plans/2026-05-10-docs-code-sync.md) завершён → переход к Phase 4 без долга в документации.

Текущее состояние frontend: `app/app.vue` (`<UApp><NuxtPage /></UApp>` wrapper) и `app/pages/index.vue` (stub). Все pages, components, composables, stores, lib — Phase 4 work. Стек установлен на уровне `nuxt: ^4.4.2` + `@nuxt/ui: ^4.7.0`; остальные frontend-зависимости (Pinia, vue-query, ECharts, vuedraggable, Inspira UI, vue-bits, vee-validate, @nuxt/icon, @nuxt/google-fonts, @vueuse/core) — не установлены.

Roadmap (детали в [`09-frontend-design.md`](09-frontend-design.md) → Target):

1. **Auth flow** — pages: `/auth/login`, `/auth/register`. Composable `useAuth()`. Pinia auth-store.
2. **Workspace + Board view** — drag-n-drop задач (vuedraggable), real-time SSE-updates через `useBoardStream()` поверх `useEventSource` (@vueuse/core), WIP-индикаторы.
3. **Task detail panel** — описание, assignees, priority, state. Без комментариев и attachments.
4. **Analytics dashboard** — CFD, throughput, Monte Carlo card, cycle-time scatter, Little's Law рекомендации (ECharts).
5. **Sprint planning** — backlog view, drag в активный спринт, start/close controls.
6. **Settings + Members** — workspace settings, RBAC management UI (5 ролей).

## Phase 5 — Production-readiness (предстоит)

> **Триггер старта:** Phase 4 завершена, MVP готов к показу первому клиенту / комиссии. До этого момента prod-деплоя нет, поэтому все ниже-перечисленные задачи преждевременны.

- **Deploy:** `Dockerfile` + `docker-compose.prod.yml` + `Caddyfile` (Caddy как reverse-proxy + TLS через Let's Encrypt). См. [`06-system-architecture.md`](06-system-architecture.md) → Target → Caddy.
- **Backups:** ежесуточный `pg_dump` → Object Storage (Yandex Object Storage / MinIO). См. [`11-non-functional.md`](11-non-functional.md) → Target → backups.
- **Observability:** `pino` (уже в `package.json`, не подключён) → structured JSON logs; `requestId` middleware + `X-Request-ID` response header. См. [`11-non-functional.md`](11-non-functional.md) → Target → observability.
- **CI/CD:** GitHub Actions / GitFlic CI — typecheck + vitest + build на каждый push. См. [`11-non-functional.md`](11-non-functional.md) → Target → CI/CD.
- **Rate limit на `/api/auth/login`** (5 попыток / 5 мин на email + IP).
- **HTTP security headers:** CSP, HSTS, X-Frame-Options через Caddyfile.
- **Code quality fixes** (mini-PR, см. backlog в `COMPACT.md`):
  - `task_events.task_id` `ON DELETE CASCADE` → `SET NULL` + `task_id_snapshot` (сохранить аналитику при hard-delete task).
  - `assertNotLastOwner`: `SELECT ... FOR UPDATE` для защиты от race condition.
  - `deleteSprint`: атомарная проверка `state != 'active'`.
  - RLS на `workspaces` + `workspace_members` (известное отставание из Phase 1).

## Phase 6+ (Target / по запросу)

Список зафиксирован в [`docs/audit-2026-05-10-issues.md`](audit-2026-05-10-issues.md) разделы 2.2-2.3 и в Target-секциях каждого `0X-*.md` дока. Ключевые блоки:

- **Multi-project workspace** (`projects` entity), `task_comments`, `task_attachments`, `task_tags`, magic-link `invitations`, server-side `sessions` с revoke. См. [`07-domain-model.md`](07-domain-model.md) → Target.
- **2FA, SSO** (Yandex ID / GitFlic ID OAuth, SAML), **WebAuthn / Passkeys**. См. [`11-non-functional.md`](11-non-functional.md) → Target.
- **Audit log** (`audit_log` table, retention 7 лет — Enterprise compliance). См. [`07-domain-model.md`](07-domain-model.md) → Target.
- **Billing** (ЮKassa / CloudPayments).
- **Telegram-бот, Pachca/VK Teams бот, Webhook'и** (универсально через pg-boss + worker dispatch). См. [`06-system-architecture.md`](06-system-architecture.md) → Target.
- **GitFlic / GitVerse привязка коммитов к задачам**.
- **Импорт из Jira / Trello / Kaiten**.
- **On-prem deploy pack**.
- **Кросс-командная (multi-project) аналитика, percentile-based alerts на застрявшие задачи**. См. [`10-analytics-design.md`](10-analytics-design.md) → Target.
- **ML research extension** (вне MVP — research scope для диплома, не product feature).

Каждая позиция вводится по конкретному триггеру (бизнес или нагрузка). См. соответствующие Target-секции `0X-*.md` docs.

## Критерии готовности (DoD)

### DoD для фичи (любой)
- [ ] Спецификация OpenAPI обновлена, типы регенерированы на обе стороны (когда code-first OpenAPI пайплайн будет настроен в Phase 5).
- [ ] Unit-тесты на бизнес-логику (services).
- [ ] Integration-тесты на happy path API endpoint'ов.
- [ ] RLS-guard test, если фича затрагивает tenant-scoped таблицы.
- [ ] Frontend-страница работает в браузере (ручная проверка).
- [ ] Error paths обработаны (404, 403, валидация, конфликты state machine).
- [ ] Документация обновлена, если фича меняет архитектуру.
- [ ] Нет новых TODO в коде без ticket-ID.

### DoD MVP (месяц 3, к предзащите)
- [ ] Все MUST-фичи реализованы (backend ✅; frontend — Phase 4).
- [ ] Демо-сценарий воспроизводится end-to-end на staging.
- [ ] Monte Carlo прогноз даёт правдоподобные числа на sandbox-данных (≥ 14 дней истории).
- [ ] CFD, throughput, cycle time работают с минимум 30 завершёнными задачами за 3 спринта.
- [ ] Docker Compose запускается на чистой машине.
- [ ] README описывает setup локально и на Yandex Cloud.
- [ ] Основные тесты (unit + integration) проходят в CI.

### DoD к защите (месяц 9)
- [ ] Target-state архитектура из соответствующих документов реализована (по согласованию с триггерами).
- [ ] Research-эксперимент проведён, результаты описаны в дипломе.
- [ ] 3+ тестовых команды использовали продукт, собрана обратная связь.
- [ ] Инфраструктура готова к платным пользователям (Phase 5 завершена).
- [ ] Текст диплома соответствует состоянию кода.

## Риски и митигация

| Риск | Вероятность | Влияние | Митигация |
|------|-------------|---------|-----------|
| Frontend MVP (Phase 4) не успевает к предзащите | Средняя | Высокое | Backend готов и стабилен (124 теста); UI делается поверх работающего API |
| Недостаточно данных для Monte Carlo к демо | Высокая | Среднее | Sandbox-данные генерируются скриптом из статистических распределений; пороги `MIN_DAYS_OF_HISTORY = 14` уже валидируют входные данные |
| Переусложнение в процессе | Средняя | Высокое | Каждое расширение Target-блока требует измеримого триггера; YAGNI на этапе ревью |
| Баги в RLS → утечка данных | Низкая | Критическое | RLS integration test в CI обязателен; FORCE RLS на runtime-роли `scrumban_app` |
| Сбой инфры перед демо | Низкая | Высокое | Staging-инсталляция отделена от dev; репетиция демо за 3 дня |
| Усталость / выгорание соло | Высокая | Высокое | Максимум 20 ч/неделю; отпуск после каждой фазы; ранние итерации minimal |

## Связанные документы
- [`06-system-architecture.md`](06-system-architecture.md) — архитектура под этот scope.
- [`07-domain-model.md`](07-domain-model.md) — доменная модель и Target-расширения схемы.
- [`08-backend-design.md`](08-backend-design.md) — backend-план.
- [`09-frontend-design.md`](09-frontend-design.md) — frontend (Phase 4) детали.
- [`10-analytics-design.md`](10-analytics-design.md) — детали аналитики.
- [`11-non-functional.md`](11-non-functional.md) — non-functional / Phase 5 deliverables.
- [`audit-2026-05-10-issues.md`](audit-2026-05-10-issues.md) — реестр Target-задач и code-debt'а.
