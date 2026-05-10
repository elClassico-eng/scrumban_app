# Аудит Scrumban — список выявленных проблем

**Дата аудита:** 2026-05-10
**Стратегия синхронизации:** документация — источник правды, код должен догнать.
**Назначение файла:** передать список проблем следующей сессии для совместного разбора и планирования. Здесь только факты расхождений, без рекомендаций и плана действий.

---

## 0. Что зафиксировано как корректное (чтобы случайно не сломать при правках)

- **9 таблиц** в коде: `users`, `workspaces`, `workspace_members`, `boards`, `board_columns`, `tasks`, `task_events`, `sprints`, `sprint_tasks`.
- **~38 HTTP endpoint-ов** через Nitro file-routing, **124 теста зелёные**.
- **RLS работает корректно**: `FORCE ROW LEVEL SECURITY` на 8 tenant-таблицах, two-role Postgres setup (`scrumban` для миграций, `scrumban_app` для рантайма с `NOBYPASSRLS`), `NULLIF`-guard в политиках, `withTenant()` helper как единственный путь.
- **State machine task lifecycle** (`moveTask`): корректная обработка `closedAt`/`reopenedCount`, reopen считается только если task был реально закрыт.
- **State machine sprint lifecycle**: партиальный unique index `WHERE state = 'active'` гарантирует «один активный спринт на доску».
- **Аналитика на task_events**: throughput, cycle time с min-sample threshold, CFD, Monte Carlo bootstrap (1000 итераций), Little's Law.
- **RBAC**: `roleAtLeast`/`strictlyOutranks` как единственный источник правды; «last owner» guard.
- **Domain errors**: `NotFoundError`/`ForbiddenError`/`ConflictError`/`ValidationError`/`UnauthorizedError` + `toHttpError` маппинг.
- **Reorder через парковку**: в `moveTask` (`PARKING_POSITION = 1_000_000`) и `reorderColumns` (offset 10000).

---

## 1. Расхождения схемы БД (docs/07-domain-model.md, UML ER, UML Class vs server/db/schema/)

### 1.1 Сущности, описанные в docs, отсутствующие в коде

| Сущность | Где упомянута | Назначение по docs |
|----------|---------------|---------------------|
| `projects` | ER, Class, Domain Model, MVP Roadmap, Use-case | Контейнер досок и спринтов в workspace |
| `task_comments` | ER, Class, Domain Model, MVP Roadmap (MUST), Use-case (UC_CommentTask) | Комментарии с историей изменений (markdown) |
| `task_attachments` | ER, Class, Domain Model, Use-case (UC_AttachFile) | Вложения файлов через S3-compat |
| `task_tags` | ER, Class, Domain Model | M:N теги задач |
| `invitations` | ER, Class, Domain Model, Use-case (UC_AcceptInvite), Phase 1 roadmap | Приглашения по email с magic-link токеном |
| `sessions` | ER, Class, Domain Model, sequence/login.puml | Серверные сессии с SHA-256 token, IP, UA |
| `feature_flags` | ER, Class, Domain Model, NFR | Глобальные/per-workspace флаги |
| `flow_daily` | ER, Class, Domain Model, Analytics Design | Агрегат для CFD по дню/проекту/колонке |
| `cycle_time_samples` | ER, Class, Domain Model, Analytics Design | Один ряд на проход задачи через колонку |
| `sprint_stats` | ER, Class, Domain Model, Analytics Design | velocity, throughput, avg cycle time per sprint |
| `audit_log` | Domain Model, NFR (Enterprise) | Отдельный аудит-лог с retention 7 лет |

### 1.2 Materialized views, описанные в docs, отсутствующие в коде

- `mv_cfd_last_90d` — refresh ежечасно.
- `mv_throughput_weekly` — refresh ежедневно, входит в monte-carlo sequence diagram.
- `mv_cycle_time_percentiles` — refresh ежечасно по column_role.

### 1.3 Универсальная таблица `events` vs специализированный `task_events`

- В docs/ER `events` — общая таблица с полями `entity_type`, `entity_id`, `event_type`, `payload jsonb`, индексы `(workspace_id, occurred_at DESC)`, `(workspace_id, entity_type, entity_id, occurred_at)`, `(workspace_id, event_type, occurred_at)`.
- В коде `task_events` — специализированно для задач, с `from_column_id`/`to_column_id` колонками, индексы `(workspace_id)`, `(task_id)`, `(workspace_id, created_at)`.
- В docs описаны event-types: `task_created`, `task_updated`, `task_moved_column`, `task_assigned`, `task_sprint_changed`, `task_points_changed`, `task_closed`, `task_reopened`, `sprint_created`, `sprint_started`, `sprint_closed`, `column_wip_breached`. В коде реализованы только: `task_created`, `task_moved`, `task_closed`, `task_reopened`, `task_assigned`, `task_updated`, `task_archived` (имена частично иные, sprint-events отсутствуют, `column_wip_breached` отсутствует).

### 1.4 Поля, описанные в docs, отсутствующие или отличающиеся в коде

**`users`:**
- В docs: `name`, `avatar_url`, `locale`, `last_seen_at`, `deleted_at`. В коде: только `email`, `passwordHash`, `createdAt`, `updatedAt`.
- В docs: id описан как UUID v7. В коде: `defaultRandom()` (UUID v4).

**`workspaces`:**
- В docs: `plan` (free/pro/enterprise), `owner_id` FK, `settings jsonb`, `archived_at`. В коде: только `name`, `slug`, `createdAt`, `updatedAt`. Плюс owner определяется через `workspace_members.role='owner'`.

**`workspace_members`:**
- В docs роли: `owner`, `admin`, `member`, `viewer` (4 роли в `11-non-functional.md`).
- В коде enum 5 ролей: `viewer`, `member`, `scrum_master`, `admin`, `owner`.
- В `roles-guide.md`: 5 ролей (правильно).
- Внутреннее противоречие в docs.

**`boards`:**
- В docs: `project_id` FK (1:1 с проектом в MVP), `type` (`scrumban`/`scrum`/`kanban`). В коде: нет `project_id` (привязка прямо к workspace), нет `type`.

**`board_columns` (в docs `columns`):**
- В docs: `is_terminal bool`, `wip_strict bool`, `column_role` включает `other`. В коде: нет `is_terminal`, нет `wip_strict`, в enum только `backlog`/`in_progress`/`review`/`done`/`archived`.

**`tasks`:**
- В docs: `project_id`, `sprint_id` (на самой task), `short_id` (например, "SCB-123"), `type` (story/bug/task/epic), `story_points`, `estimate_hours`, `reporter_id`. В коде: ничего из этого нет; sprint-привязка через `sprint_tasks` M:N.
- В docs `priority`: `low/normal/high/urgent`. В коде: `low/medium/high`.
- В docs uniq `(workspace_id, project_id, short_id)`. В коде нет.

**`sprints`:**
- В docs: `project_id`, `created_by`. В коде: `boardId` (без projects), нет `created_by`.
- В docs: `start_at`, `planned_end_at`, `closed_at`, `status`. В коде: `plannedStartAt`, `plannedEndAt`, `startedAt`, `endedAt`, `state`. Имена и семантика расходятся (нет `closed_at`, есть `endedAt`).

---

## 2. Функциональные пробелы (фичи в docs, не в коде)

### 2.1 Из MUST scope (docs/05-mvp-scope-and-roadmap.md)

- Email/password восстановление пароля (email link, 1 час TTL, одноразовый).
- Приглашение по email через magic-link.
- Несколько проектов в workspace.
- Комментарии с историей изменений.
- Story points + velocity.
- Burndown chart.
- WIP-лимиты (soft warning) — в коде есть hard enforcement с force-override, но соответствие «soft» не задокументировано.
- Cycle time / Lead time (в коде есть только cycle, lead time от created до closed не вынесен).
- Bottleneck detection (по distribution времени в колонках) — в коде нет, есть только Little's Law рекомендации.

### 2.2 Из SHOULD scope

- Файлы/вложения (Object Storage).
- Scatter plot cycle time с percentile-аналитикой (в коде есть данные, но frontend-визуализации нет).
- Сравнение спринтов / периодов.
- Telegram-бот для уведомлений.

### 2.3 Из LATER scope

- Кросс-командная (multi-project) аналитика.
- Percentile-based alerts на застрявшие задачи.
- ML research extension.
- Webhook'и (универсально).
- Pachca/VK Teams бот.
- GitFlic/GitVerse привязка коммитов к задачам.
- Импорт из Jira/Trello/Kaiten.
- Audit log.
- SSO (OAuth, SAML).
- Биллинг (ЮKassa / CloudPayments).
- On-prem deploy pack.

---

## 3. Нефункциональные пробелы (NFR из docs/11-non-functional.md, отсутствующие в коде)

### 3.1 Auth / Security

- Rate limiting на `/api/auth/login` (5 попыток / 5 мин на email; CAPTCHA или блокировка на 15 мин). Не реализован.
- Восстановление пароля (email-ссылка с токеном). Не реализовано.
- Глобальный logout / revoke сессии (требует таблицы `revoked_sessions`). Не реализован.
- 2FA (TOTP). Не реализован.
- SSO (OAuth/OIDC, SAML). Не реализованы.
- Webauthn / Passkeys. Не реализовано.
- Audit log auth-событий. Не реализован.
- CSRF: нет дополнительных токенов, полагаемся только на `SameSite=Lax`. Реализация cookie через nuxt-auth-utils, явно не задокументирована в коде.
- HSTS, CSP headers, X-Frame-Options. В коде/конфиге Caddy не сконфигурированы (Caddyfile отсутствует в репозитории).

### 3.2 Observability

- pino: импортирован в `package.json`, но не интегрирован в endpoints/middleware. Нет structured request logging.
- `requestId` middleware и `X-Request-ID` response header. Не реализованы.
- Логи с обязательными полями `time/level/msg/requestId/userId/workspaceId/traceId`. Не реализованы.
- Sentry. Не интегрирован.
- Prometheus endpoint `/api/metrics`. Не реализован.
- OpenTelemetry traces. Не реализованы.

### 3.3 Контракт API

- `openapi/scrumban.yaml`. Файл отсутствует.
- `zod-to-openapi` (или `@asteasolutions/zod-to-openapi`). Зависимость не установлена.
- `openapi-typescript`. Зависимость не установлена.
- `shared/types/api.d.ts` (auto-generated TS-client). Отсутствует. В `shared/types/` только `auth.d.ts` для расширения типов nuxt-auth-utils.
- Frontend ↔ backend через сгенерированные типы — невозможно.
- `pnpm codegen` script в package.json. Отсутствует.
- `pnpm openapi:generate` script. Отсутствует.

### 3.4 Background jobs

- pg-boss упомянут в стеке pivot-spec. Зависимость не установлена. Папка `server/plugins/` пустая.
- Background-задачи (webhook dispatch, email, aggregate recompute, MC refresh) — не существуют как код.

### 3.5 Real-time scaling

- Postgres LISTEN/NOTIFY для cross-node SSE fan-out. Не реализован.
- `EventEmitter` работает только в одной реплике; при scale-out события другой реплики не доходят.

### 3.6 Aggregates / Performance

- Триггеры на `task_moved_column` для инкрементального обновления `flow_daily`. Не реализованы (агрегата нет).
- Refresh materialized views по расписанию. Не реализован.
- Forecast Cache (LRU, TTL 15 мин) для Monte Carlo. Не реализован.
- Кэширование heavy analytics. Не реализовано.

### 3.7 Backups / Restore

- Ежесуточный pg_dump → Object Storage. Не сконфигурирован.
- WAL-archiving (Target). Нет.
- Restore-test автоматизирован. Нет.
- Object Storage backup integration. Нет.

### 3.8 CI/CD

- `.github/workflows/`. Отсутствует.
- `.gitflic-ci/`. Отсутствует.
- typecheck + vitest + build pipeline. Локально работает, в CI не настроено.

### 3.9 Deployment

- `Dockerfile` для prod. Отсутствует.
- `docker-compose.prod.yml`. Отсутствует (есть только `docker-compose.dev.yml` для Postgres).
- Caddyfile / reverse-proxy config. Отсутствует.
- systemd unit / docker secrets. Не задокументированы.

---

## 4. UML-диаграммы — расхождения с кодом

### 4.1 ER-диаграмма (`docs/uml/03-er/database.puml`)

- 18 entities в диаграмме, 9 в коде.
- Лишние entities: `invitations`, `sessions`, `projects`, `task_tags`, `task_comments`, `task_attachments`, `events` (как универсальная), `flow_daily`, `cycle_time_samples`, `sprint_stats`, `feature_flags`.
- В `boards`: показывается `type text`, в коде нет.
- В `columns`: показывается `is_terminal`, `wip_strict` — в коде нет.
- В `tasks`: показывается `project_id`, `sprint_id`, `short_id`, `type`, `story_points`, `estimate_hours`, `reporter_id` — в коде нет.
- В `sprints`: показывается `project_id`, `start_at`, `created_by` — в коде нет.
- Composite indexes у task: `(workspace_id, project_id, short_id)` — нерелевантно.

### 4.2 Class-диаграмма (`docs/uml/02-class/domain-classes.puml`)

- Лишние классы: `Project`, `TaskTag`, `TaskComment`, `TaskAttachment`, `Invitation`, `Session`, `FeatureFlag`.
- Лишние enums: `WorkspacePlan` (FREE/PRO/ENTERPRISE), `BoardType` (SCRUMBAN/SCRUM/KANBAN), `TaskType` (STORY/BUG/TASK/EPIC).
- Несоответствующий `TaskPriority`: в class — LOW/NORMAL/HIGH/URGENT, в коде — low/medium/high.
- Несоответствующий `Role` enum: 4 роли в class (OWNER/ADMIN/MEMBER/VIEWER) vs 5 в коде.
- `ColumnRole` enum: BACKLOG/IN_PROGRESS/REVIEW/DONE/OTHER vs `backlog/in_progress/review/done/archived` в коде. `OTHER` отсутствует, `archived` отсутствует.
- Отношения с агрегатами (workspace → flow_daily / cycle_time_samples) ссылаются на нереализованные сущности.

### 4.3 Component-диаграмма (`docs/uml/04-component/components.puml`)

- Components, описанные но не реализованные: Worker (pg-boss с поддиаграммами WkWebhook/WkEmail/WkAgg/WkMC), Aggregator (для flow_daily/cycle_samples), Email Sender, LISTEN/NOTIFY Bridge, Feature Flags, Webhook Dispatcher, MC Refresh.
- Database-tier: показаны `events (append-only)` (универсальная), `Aggregates + mat.views`, `pg-boss (job queue)`, `LISTEN/NOTIFY channel` — ничего из этого в коде нет.
- External services: SMTP, Bot (Telegram/Pachca), Git Platform — интеграций нет.
- Sticky sessions для SSE через Caddy — в проекте Caddyfile отсутствует.
- В диаграмме упоминается «AnaAgg --> PgEvents : subscribe via trigger» — триггеров нет.

### 4.4 Sequence: login (`docs/uml/06-sequence/login.puml`)

- Показана `sessions` таблица с операциями `INSERT INTO sessions(user_id, token_hash, ...)` — таблица не существует в коде.
- Показана генерация random session token (256-bit) и SHA-256 хэширование — реальная реализация: подписанный cookie через `nuxt-auth-utils.setUserSession()`.
- Показано `argon2id.Verify(password, hash)` — реально используется `verifyPassword()` из `nuxt-auth-utils` (scrypt по умолчанию).
- Показан Set-Cookie с raw token, Max-Age=7d — реальная реализация полностью внутри nuxt-auth-utils.
- Показан Pinia auth.setUser(user) — Pinia пока не подключён.
- API path `/api/v1/auth/login` — реальный путь `/api/auth/login` (без `v1`).

### 4.5 Sequence: create-task-sse (`docs/uml/06-sequence/create-task-sse.puml`)

- Показан path `POST /api/v1/projects/{pid}/tasks` — реальный путь `POST /api/workspaces/{id}/boards/{boardId}/tasks` (нет `v1`, нет `projects`).
- Показан path `GET /api/v1/workspaces/{wsId}/stream` — реальный путь `GET /api/workspaces/{id}/boards/{boardId}/stream`.
- В payload передаётся `project_id` — в коде такого поля нет.
- Показан `INSERT INTO events(workspace_id, event_type, entity_id, payload, ...)` — реально вставка в `task_events` со специализированными колонками.
- Показан `Worker (pg-boss)` поток с `EnqueueNotifyJob` → HTTP POST Telegram/Pachca — не реализовано.
- Sticky cookie на Caddy не настроен.

### 4.6 Sequence: monte-carlo (`docs/uml/06-sequence/monte-carlo.puml`)

- Path `GET /api/v1/projects/{pid}/sprints/{sid}/forecast` — реальный путь `GET /api/workspaces/{id}/boards/{boardId}/analytics/monte-carlo`.
- Forecast Cache (LRU, 15 мин) — не реализован.
- Источник истории: `sprint_stats` и `mv_throughput_weekly`, `LIMIT 5` спринтов. Реально: дневной throughput за 90 дней, expandWithZeros для дней без закрытий.
- Show: `CountRemainingTasks(sprintId)` через `tasks WHERE sprint_id=$1 AND closed_at IS NULL` — `tasks.sprint_id` в коде нет.
- Threshold: «<3 спринтов = insufficient_data». Реально: <14 дней с любой историей или 0 закрытых задач за 90 дней.
- Параметры: `daysLeft`, `nSimulations` приходят из БД спринта. Реально: `tasksRemaining`, `horizonDays`, `iterations` приходят из query string.

### 4.7 Use-case диаграмма (`docs/uml/01-use-case/use-case.puml`)

- Use-cases без реализации: `UC_AcceptInvite`, `UC_AttachFile`, `UC_CommentTask`, `UC_LinkCommit`, `UC_RecomputeAgg`, `UC_UpdateMC`, `UC_CreateProject`, `UC_ArchiveProject`, `UC_SendEmail`, `UC_SendNotification`, `UC_ResetPwd`, `UC_EditProfile`, `UC_ViewBottleneck`, `UC_CompareSprints`, `UC_ViewScatter`, `UC_WSSettings`, `UC_ArchiveWS`.
- Реализованные use-cases: `UC_Register`, `UC_Login`, `UC_CreateWS`, `UC_InviteMember` (только частично — без email), `UC_ManageRoles`, `UC_ConfigBoard`, `UC_CreateTask`, `UC_AssignTask`, `UC_MoveTask`, `UC_EditTask`, `UC_ViewTask`, `UC_CreateSprint`, `UC_PlanSprint`, `UC_StartSprint`, `UC_CloseSprint`, `UC_ViewCFD`, `UC_ViewThroughput`, `UC_ViewMC`, `UC_ViewWIPRec`.
- Внешние акторы (SMTP, Bot, Git Platform, Cron) — интеграций нет.
- Inheritance ролей в use-case (5 ролей) — соответствует коду.
- В per-role диаграммах те же расхождения.

### 4.8 State-machine диаграммы

- `task-lifecycle.puml` — почти полное соответствие коду. Незначительные расхождения:
  - В диаграмме `entry / set deleted_at = now()` для Archived — в коде `archived` это просто колонка с `column_role='archived'`, нет отдельного `deleted_at` на task.
  - Path `Backlog --> [*] : delete (только если невыполнено любой работы и роль = Admin)` — в коде hard delete доступен любому admin без проверки «никакой работы не было».
  - Diagram использует имена `task_moved_column`, `task_closed`, `task_reopened`. В коде имена `task_moved`, `task_closed`, `task_reopened`, `task_archived`.
- `sprint-lifecycle.puml` — почти полное соответствие. Расхождения:
  - События `sprint_started`, `sprint_closed`, `sprint_cancelled` — в коде не пишутся в task_events (для спринтов событий нет).
  - SSE broadcast `sprint_started` — в коде нет; SSE для sprints не реализован.
  - Trigger `sprint_stats` пересчёт — таблицы нет.
  - «задачи unclosed → rollover в следующий Planned sprint» — не реализовано.

### 4.9 Deployment-диаграмма

- Папка `docs/uml/05-deployment/` существует, но пуста — диаграмма не создана.
- В `docs/uml/README.md` deployment диаграмма указана как существующая.
- В `COMPACT.md` пометка «Deployment пропущен по решению user — может быть добавлен позже».

---

## 5. Расхождения между документами (внутри docs, без code-related)

- `09-frontend-design.md` упоминает Nuxt 3, после pivot 2026-04-23 стек — Nuxt 4.
- `09-frontend-design.md`: «BFF (proxy-агрегация к Go API)» — Go-стек устарел после pivot.
- `09-frontend-design.md`: показана структура `frontend/` как отдельная папка — реально monorepo, всё в `app/`.
- `11-non-functional.md`: 4 роли в RBAC matrix (Owner/Admin/Member/Viewer). В `roles-guide.md` и в коде — 5 ролей с `scrum_master`.
- `11-non-functional.md`: упоминается `extractWorkspaceFromPath` middleware — middleware-папки нет, каждый handler сам извлекает workspaceId.
- `08-backend-design.md`: описана структура `server/middleware/` (auth.ts, tenant.ts, rbac.ts), `server/sse/`, `server/events/`, `server/analytics/`, `server/ff/` — реально всё в `server/utils/` и `server/services/`.
- `08-backend-design.md`: упоминается `shared/types/api.d.ts` — отсутствует.
- `06-system-architecture.md`: упоминаются components Worker, Aggregator, Email Sender, LISTEN/NOTIFY — не реализованы.
- `06-system-architecture.md`: «pg-boss workers» как часть Nitro — pg-boss не установлен.
- `06-system-architecture.md`: «Caddy как единая точка входа со sticky sessions» — Caddyfile в проекте отсутствует.
- `10-analytics-design.md`: «Реализация: Go-пакет `internal/analytics/montecarlo.go`» — артефакт ошибочно сохранился после pivot.
- `10-analytics-design.md`: «Запускается on-demand при просмотре спринт-дашборда (результат кэшируется 15 мин)» — кэша нет.
- `10-analytics-design.md`: «Или пересчитывается фоновым job'ом после каждого `task_closed` в активном спринте» — не реализовано.
- `10-analytics-design.md`: «Минимум данных Monte Carlo: ≥3 завершённых спринта или ≥20 закрытых задач за последние 4 недели». В коде: `MIN_DAYS_OF_HISTORY = 14` и `totalClosed === 0`.
- `10-analytics-design.md`: bottleneck detection через `cycle_time_samples` p85 — нет в коде.
- `10-analytics-design.md`: percentile-based stuck-task alerts ≥30 проходов — нет.
- `05-mvp-scope-and-roadmap.md` Phase 1: «invitation table» — не создана.
- `05-mvp-scope-and-roadmap.md` Phase 2: «Project, Board, Column, Task, TaskComment» — Project, TaskComment не созданы.
- `05-mvp-scope-and-roadmap.md` Phase 2: «RBAC middleware в backend» — middleware-папки нет.
- `05-mvp-scope-and-roadmap.md` Phase 3: «flow_daily агрегат» — нет.
- `05-mvp-scope-and-roadmap.md` Phase 3: «Запись событий (sprint_started, …)» — нет sprint events.
- `05-mvp-scope-and-roadmap.md` Phase 4: Little's Law рекомендации описаны как Phase 4. В реальности уже в Phase 3 (за scope).
- `05-mvp-scope-and-roadmap.md` Phase 5: «Полноценный RLS в Postgres» — реально RLS уже в Phase 2.
- `05-mvp-scope-and-roadmap.md` Phase 5: «Multi-workspace UI» — UI вообще нет.
- `05-mvp-scope-and-roadmap.md` Phase 5: «Audit log» — нет.
- `docs/uml/README.md`: упоминается deployment диаграмма как существующая.
- `docs/uml/README.md`: в табличке Component «Nuxt / Go / Postgres / Storage / Caddy» — Go устарел.
- `docs/superpowers/specs/2026-04-18-scrumban-platform-design.md` — original Go-spec, заменён pivot-ом, но ссылки на него остались в `docs/uml/README.md`.
- В `users.ts` schema комментарий: «Password is stored as an argon2id hash (computed by nuxt-auth-utils)». Реально nuxt-auth-utils использует scrypt по умолчанию. В `08-backend-design.md` есть исправление «scrypt by default; argon2id configurable», в `users.ts` комментарий не обновлён.
- В `register.post.ts` комментарий: «hashes the password via nuxt-auth-utils (argon2id)». Аналогично — устарело.
- В `11-non-functional.md`: пример `withTenant` использует `SET LOCAL app.workspace_id = ${workspaceId}`. Реальная реализация в коде — `SELECT set_config('app.workspace_id', ${workspaceId}, true)` (важное отличие: SET LOCAL не принимает $1 placeholders, set_config принимает).
- В `11-non-functional.md`: tenant middleware пример с `extractWorkspaceFromPath(event)` — реально извлечение workspaceId происходит в каждом handler через `getValidatedRouterParams`.

---

## 6. Расхождения комментариев в коде vs реальная реализация

- `server/api/auth/register.post.ts`: комментарий упоминает argon2id, реально scrypt.
- `server/db/schema/users.ts`: комментарий упоминает argon2id, реально scrypt.
- `server/utils/db.ts`: комментарий упоминает «`SET LOCAL`», реально `set_config(... , is_local=true)`. Это технически синонимы для is_local=true, но именование в комментарии может вводить в заблуждение.

---

## 7. Code quality issues (независимы от docs)

- `PARKING_POSITION = 1_000_000` в `tasks.service.ts` — hard limit на количество задач в одной колонке (если когда-нибудь >999_999, парковка коллизит).
- `reorderColumns`: offset `position + 10000` — гипотетический collision risk при concurrent reorder большого числа колонок (>10_000 в одной board); транзакция должна защитить, но не задокументировано.
- `server/db/schema/boards.ts`: импорт `import { sql } from 'drizzle-orm'` сделан в конце файла (после definitions). Стилевая шероховатость, не функциональная.
- `server/utils/db.ts`: `useDB()` singleton не имеет graceful shutdown. При тестах с testcontainers возможны зависшие соединения.
- `server/db/schema/tasks.ts`: `task_events.task_id` имеет `ON DELETE CASCADE` на `tasks.id`. При hard delete task вся история теряется (аналитика «забывает» прошлое).
- `server/db/schema/tasks.ts`: `tasks.reopened_count` не индексируется. Запрос «найти задачи с reopened_count >= N» — full scan.
- `server/services/workspace-members.service.ts`: `assertNotLastOwner` может иметь race condition при двух параллельных операциях демоушна последних двух владельцев одновременно (нет ROW LOCK на момент проверки).
- WIP enforcement: только на cross-column moves. Re-balance внутри column не проверяется — но это by design.
- `tasks.service.ts moveTask`: если `fromCol` не найден (`fromCol = undefined`) — продолжает выполнение. В реальности `fromCol` должен всегда существовать (FK), но defensive code не делает throw, использует `?` chaining.
- `server/services/sprints.service.ts deleteSprint`: после soft check `result.count === 0` — нет атомарной проверки, что sprint был в неактивном state. Можно случайно удалить active sprint.
- `tests/helpers/db.ts`: не проверял содержимое; возможный риск — если там disable RLS для тестов, RLS-isolation тесты становятся условными. Требует ревью.
- `boards`: slug unique только в workspace. При мягком удалении и повторном создании — конфликтов нет, но и формального восстановления нет.
- `workspaces`: slug global unique — при множестве клиентов вероятны коллизии (e.g., все хотят `acme`).

---

## 8. Frontend gap

- `app/app.vue`: только `<UApp><NuxtPage /></UApp>`.
- `app/pages/index.vue`: только заглушка «Skeleton is up».
- Отсутствуют все pages: login, register, forgot-password, reset-password, dashboard, workspace, board, task detail, sprint, analytics, settings, members, billing.
- Отсутствуют все components: Board, Column, TaskCard, TaskDetailPanel, CommentList, CFDChart, ScatterChart, ThroughputChart, MonteCarloCard, BottleneckHeatmap, StatsCard, GlassCard, GradientHero, AppSidebar, AppHeader, Breadcrumbs, WIPIndicator.
- Отсутствуют все composables: useWorkspace, useBoard, useSSE, useAuth, useAnalyticsCopy, useTasks.
- Отсутствуют Pinia stores: auth, workspace, board.
- Отсутствует API client: lib/api-client.ts (Current) или lib/api/ (Target generated).
- Отсутствует SSE composable.
- Не подключены: `@tanstack/vue-query`, `vuedraggable`, `inspira-ui`, `vue-bits`, `ECharts`, `vee-validate`, `@nuxt/icon`, `@nuxt/google-fonts`, `VueUse`.
- Отсутствует `analytics-copy.ts` с UX-переводами цифр.
- Отсутствует CSS palette setup (CSS custom properties для dark theme).
- Отсутствует tailwind.config.ts (минимальный — но без расширений из design доков).
- Условия отображения аналитики (placeholder при недостатке данных) — нет фронта для отображения.

---

## 9. Test coverage gaps

- 124 теста есть, в основном happy-path и базовые edge cases.
- Не покрыто:
  - Concurrent reorder columns на одной board.
  - Race condition в `assertNotLastOwner` при двух одновременных demote.
  - Slug collisions при удалении и повторном создании workspace/board.
  - Behavior при огромном количестве событий в task_events (CFD performance).
  - SSE: множественные клиенты, отключения, heartbeat correctness.
  - SSE: behaviour при disconnect mid-stream и reconnect.
  - Monte Carlo: edge case `tasksRemaining = 0`, `horizonDays = 0` (есть в коде, но тестов на ответ нет в видимом наборе).
  - Force=true override для WIP — есть в коде, но coverage для этого пути не проверял.
  - Frontend тестов нет (skeleton не нужен — но позже это блокер).
  - Load tests / k6 / performance — отсутствуют.
  - Contract testing (schemathesis или аналог) — отсутствует.
  - RLS guard test существует (`tests/rls.integration.test.ts`), 7 проверок — это есть. Но не покрывает все 8 tenant-scoped таблиц равномерно (нужно проверить).

---

## 10. Прочие inconsistencies

- `docs/uml/05-deployment/` — пустая папка с обещанием диаграммы.
- `docs/superpowers/plans/2026-04-23-phase0-week1-nitro-starter.md` — файл-плана для пропущенной Phase 0; оставлен «как референс», но никак не помечен «obsolete» или «reference only».
- `docs/superpowers/specs/2026-04-18-scrumban-platform-design.md` — original Go-spec, заменён pivot-ом, но всё ещё referenced в `docs/uml/README.md`.
- В `eslint.config.mjs`: не проверял правила; в pivot-spec обещано `no-restricted-imports` для границ frontend ↔ backend — нужна верификация.
- В `package.json` отсутствуют scripts: `openapi:generate`, `codegen`, `db:seed`, `lint:fix`.
- В `package.json` отсутствуют зависимости (упомянутые в стеке): `pg-boss`, `@tanstack/vue-query`, `pinia`, `@vueuse/core`, `vuedraggable`, `inspira-ui`, `vue-bits`, `vee-validate`, `echarts`, `@nuxt/icon`, `@nuxt/google-fonts`, `lucide-vue-next` (или иконки), `nodemailer`, `zod-to-openapi`, `openapi-typescript`, `@testcontainers/postgresql`.
- `bun.lock` присутствует — указывает на использование Bun как менеджера; в pivot-spec упоминается `pnpm` (`pnpm dev`, `pnpm db:generate`, `pnpm codegen`). Стилевое расхождение.

---

## Резюме разрывов по категориям

| Категория | Кол-во расхождений |
|-----------|---------------------|
| Сущности БД (отсутствуют в коде) | 11 |
| Materialized views (нет в коде) | 3 |
| Поля схемы (отсутствуют/расходятся) | ~20 |
| Функциональные пробелы из MUST scope | 9 |
| Функциональные пробелы из SHOULD scope | 4 |
| Функциональные пробелы из LATER scope | 11 |
| Нефункциональные пробелы (auth/observability/contract/jobs/scaling/agg/backups/CI/CD/deploy) | ~30 |
| UML-диаграммы с расхождениями | 7 (все, кроме state-machine) |
| Расхождения внутри docs (без code) | ~25 |
| Расхождения комментариев в коде | 3 |
| Code quality issues | ~12 |
| Frontend gap (отсутствующие pages/components/composables/stores/libs) | 100% |
| Test coverage gaps | ~10 |
| Прочие inconsistencies | ~10 |

---

**Конец списка.** Все обнаруженные расхождения зафиксированы. План работ — отдельным шагом, на основе этого файла.
