# 11 — Non-Functional Requirements

Документ разделён на **Current** (что реально работает в коде сегодня) и **Target** (куда движемся; каждая Target-секция вводится с измеримым триггером, чтобы не превратиться в «потом сделаем»). Реализационные ссылки указывают на реальные пути в репозитории.

## Аутентификация (authN)

### Current

- **Метод:** email + пароль (`server/api/auth/register.post.ts`, `server/api/auth/login.post.ts`).
- **Хэширование:** `scrypt` через `hashPassword()` / `verifyPassword()` из `nuxt-auth-utils` (default; встроен в Node.js, нативный binary не нужен). Опциональное переключение на `argon2id` требует подключения `@node-rs/argon2` — пока не сделано.
- **Сессии:** подписанный HTTP-only cookie с `userId` (через `setUserSession()`). Подпись по `NUXT_SESSION_PASSWORD` (256-bit env-секрет; в dev задаётся в `.env`, в prod — через env-runtime).
- **Cookie flags:** `HttpOnly`, `Secure` (в prod), `SameSite=Lax`. TTL — конфигурируется через `nuxt-auth-utils` config.
- **Logout:** `clearUserSession(event)` в `server/api/auth/logout.post.ts` — cookie очищается на стороне клиента.
- **Account enumeration guard:** одинаковый ответ при «user not found» и «wrong password» (см. комментарий в `login.post.ts`).

### Target: восстановление пароля

> **Триггер ввода:** первый публичный регистр / появление первого external user'а (до этого аккаунты создаются вручную через `psql` или dev-only endpoints).

Email-ссылка с одноразовым токеном (1 час жизни). Отдельная таблица `password_reset_tokens` (token_hash, user_id, expires_at, used_at). Endpoint'ы `POST /auth/forgot-password` и `POST /auth/reset-password`.

### Target: rate limiting на `/api/auth/login`

> **Триггер ввода:** первый публичный URL / появление первого реального пользователя без приглашения. Параметры: 5 попыток / 5 мин на email + IP, после превышения — CAPTCHA или 15-мин блокировка.

Реализация: in-memory bucket на одной реплике (минимум) или Postgres-таблица `login_attempts` (если ≥ 2 реплик; см. триггер обсервабилити ниже).

### Target: глобальная revoke сессий

> **Триггер ввода:** первая необходимость инвалидировать все сессии конкретного user'а (потеря устройства, увольнение). Требует таблицы `revoked_sessions` или server-side таблицы `sessions` (см. [`07-domain-model.md`](07-domain-model.md) → Target → sessions).

### Target: 2FA (TOTP)

> **Триггер ввода:** первый Enterprise-клиент с 2FA-требованием в SLA, или ≥ 30 % активных user'ов сами просят 2FA.

TOTP через authenticator-приложения (Google Authenticator, Yandex Key). Recovery-коды одноразовые.

### Target: SSO (OAuth/OIDC + SAML)

> **Триггер ввода:** первый Enterprise-клиент. Yandex ID / GitFlic ID — ранние интеграции; SAML — отдельный триггер (Enterprise > 100 seats).

### Target: Webauthn / Passkeys

> **Триггер ввода:** после SSO; запрос пользователя на passwordless или ≥ 2 пользователя жалуются на неудобство паролей.

### Target: audit log auth-событий

> **Триггер ввода:** первый Enterprise-клиент с compliance-требованием, или после первого security-инцидента (chosen-plaintext attempt, brute force, etc.).

Отдельная таблица `auth_audit_log` (event_type, user_id, ip, user_agent, occurred_at, payload_jsonb), retention ≥ 1 год.

## Авторизация (authZ) / RBAC

### Роли (Current — соответствуют коду)

- **Owner** — создатель workspace'а. Все права, включая удаление workspace.
- **Admin** — управляет членами, проектами, настройками. Не может удалить workspace.
- **Scrum Master** — управляет спринтами и аналитикой команды; не управляет членством.
- **Member** — работает с задачами: создаёт, редактирует, перемещает.
- **Viewer** — только чтение.

Иерархия: `viewer < member < scrum_master < admin < owner`. Источник правды — `server/db/schema/workspaces.ts` (`workspaceMemberRole` pgEnum) и `server/utils/rbac.ts` (`ROLE_LEVEL`).

Полное описание прав по ролям — [`docs/uml/01-use-case/roles-guide.md`](uml/01-use-case/roles-guide.md).

### Разрешения (Current — выверено по коду)

Каждая строка — действие, выполняемое каким-либо handler'ом из `server/api/**`. Минимально требуемая роль приходит из `requireMinRole(actorRole, ...)` в соответствующем сервисе (`server/services/*.service.ts`). «✓» означает, что роль удовлетворяет минимуму (выше — наследует).

| Действие | Owner | Admin | Scrum Master | Member | Viewer |
|----------|-------|-------|--------------|--------|--------|
| Просмотр workspace и членов (`listWorkspaceMembers`) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Приглашать членов по email (`addMemberByEmail`) | ✓ | ✓ | − | − | − |
| Изменять роль члена (`updateMemberRole`, `strictlyOutranks` + `assertNotLastOwner`) | ✓ | ✓ | − | − | − |
| Удалять члена (`removeMember`; self-leave разрешён всем) | ✓ | ✓ | − | − | − |
| Создавать / редактировать доски (`createBoard`, `updateBoard`) | ✓ | ✓ | − | − | − |
| Удалять доску (`deleteBoard`) | ✓ | − | − | − | − |
| Создавать / редактировать / реордерить колонки (`createColumn`, `updateColumn`, `deleteColumn`, `reorderColumns`) | ✓ | ✓ | − | − | − |
| Конфигурировать WIP-лимиты (поле `wipLimit` в `updateColumn`) | ✓ | ✓ | − | − | − |
| Создавать / редактировать / двигать задачи (`createTask`, `updateTaskFields`, `moveTask`) | ✓ | ✓ | ✓ | ✓ | − |
| Удалять задачу (`deleteTask`) | ✓ | ✓ | − | − | − |
| Создавать / обновлять / стартовать / закрывать спринт (`createSprint`, `updateSprint`, `startSprint`, `closeSprint`) | ✓ | ✓ | ✓ | − | − |
| Удалять спринт (`deleteSprint`) | ✓ | ✓ | − | − | − |
| Добавлять / удалять задачи в спринт (`addTaskToSprint`, `removeTaskFromSprint`) | ✓ | ✓ | ✓ | ✓ | − |
| Просматривать аналитику (CFD, throughput, cycle-time, Monte Carlo, WIP-recommendations) | ✓ | ✓ | ✓ | ✓ | ✓ |
| Удалять workspace | ✓ | − | − | − | − |

> **Замечание об удалении workspace:** строка отражает intended-RBAC. Сам endpoint `DELETE /workspaces/[id]` пока не реализован (см. `server/api/workspaces/` — присутствуют только `index.{get,post}.ts`, `[id].get.ts` и поддерево `[id]/...`). Это явный gap в Current и фиксируется в backlog.

### Реализация (Current)

- Helper'ы `roleAtLeast(actorRole, requiredRole)`, `requireMinRole(actorRole, requiredRole)` и `strictlyOutranks(actorRole, targetRole)` живут в [`server/utils/rbac.ts`](../server/utils/rbac.ts) — единственный источник правды для сравнения ролей. Любой ad-hoc compare вида `role === 'admin' || role === 'owner'` запрещён по комментарию в самом файле.
- `assertNotLastOwner` в `server/services/workspace-members.service.ts` запрещает понизить или удалить последнего owner'а workspace.
- Каждый сервис в `server/services/*.service.ts` сам вызывает `requireMinRole(...)` в начале каждой публичной функции (паттерн guard-clause). Handler в `server/api/**` извлекает `actorRole` из контекста и передаёт сервису. **Отдельной middleware-папки `server/middleware/` нет** — RBAC встроен в сервисы.
- Frontend условно показывает кнопки на основе `role`; **RBAC всегда проверяется на сервере**, frontend только скрывает UI.

### Target: middleware extraction

> **Триггер ввода:** ≥ 30 endpoint'ов в `server/api/**` с одинаковым RBAC-guard'ом + желание автоматически генерировать в OpenAPI описание required role.

Вынести RBAC в `server/middleware/rbac.ts` с helper'ом `requireRole(event, 'admin')` или `requirePermission(event, 'task.create')`. Сегодня — преждевременно: middleware заменит ~5 строк boilerplate'а на handler за счёт декларативности; на текущем количестве endpoint'ов (~38) выгода неощутима.

### Target: per-project роли и кастомные пермиссии

> **Триггер ввода:** первый клиент, который явно просит «admin в проекте A, viewer в проекте B» внутри одного workspace. До этого workspace-level роль покрывает все use-case'ы солопрактиков и команд до 30 человек.

- Per-project роли: user может быть admin в одном проекте и member в другом.
- Кастомные роли (назначаемый набор пермиссий).
- Guest-пользователи (доступ к одной задаче / доске без членства в workspace).

## Multi-tenancy (изоляция данных)

### Current

Один Postgres, множество workspace'ов. Изоляция реализована через:

1. **`workspace_id` в каждой tenant-scoped таблице.**
2. **Composite индексы всегда начинаются с `workspace_id`** (`(workspace_id, ...)`).
3. **Row-Level Security (RLS) в Postgres** включён на **6 таблицах из 9**: `boards`, `board_columns`, `tasks`, `task_events` (миграция `0003_rls_policies.sql` с правкой `0004_rls_nullif_fix.sql`), `sprints`, `sprint_tasks` (миграция `0006_sprints_rls.sql`). `users` исключена намеренно (глобальная, не tenant-scoped); `workspaces` и `workspace_members` пока без RLS — **известное отставание**, выписано в backlog кода (см. `COMPACT.md`).
4. **Двухролевая Postgres-схема:** `scrumban` (миграции, минует RLS) и `scrumban_app` (рантайм, FORCE ROW LEVEL SECURITY).
5. **`withTenant(workspaceId, fn)`** в [`server/utils/db.ts`](../server/utils/db.ts) — каждый handler оборачивает доменные DB-операции в эту функцию, которая выставляет `app.workspace_id` через `set_config(...)` в начале транзакции.

### RLS политика (Current — пример из миграции `0003_rls_policies.sql`)

```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE tasks FORCE ROW LEVEL SECURITY;

CREATE POLICY tasks_tenant_isolation ON tasks
  USING (workspace_id = NULLIF(current_setting('app.workspace_id', true), '')::uuid);
```

Эффект: любой `SELECT/UPDATE/DELETE` автоматически фильтруется по текущему `app.workspace_id`. Забыть `WHERE` теперь безопасно — Postgres вернёт 0 строк. `FORCE` распространяет правило и на владельца таблицы (роль `scrumban_app` не имеет BYPASSRLS).

### `withTenant()` helper (Current — `server/utils/db.ts`)

```typescript
export async function withTenant<T>(
  workspaceId: string,
  fn: (tx: DbTransaction) => Promise<T>,
): Promise<T> {
  return useDB().transaction(async (tx) => {
    // set_config(name, value, is_local=true) — функциональный эквивалент
    // transaction-scoped команды установки GUC, но принимает $1 placeholder
    // (нативная команда — нет; этим объясняется выбор set_config).
    await tx.execute(sql`SELECT set_config('app.workspace_id', ${workspaceId}, true)`)
    return fn(tx)
  })
}
```

### Tenant-scoping в handler'ах (Current)

Каждый handler в `server/api/workspaces/[id]/**` извлекает `workspaceId` через `getValidatedRouterParams(event, ...)` сам и вызывает `withTenant(workspaceId, async tx => ...)` для всех DB-операций. Middleware-слоя нет. RBAC-проверка членства — также внутри handler'а / сервиса через `findWorkspaceForUser(...)` или `requireMinRole(...)`.

### Тест безопасности (Current — обязателен в CI)

Юнит-тесты на cross-tenant изоляцию живут в `server/__tests__/integration/` и покрывают каждую RLS-таблицу через testcontainers + `withTenant(...)`. Пример паттерна:

```typescript
it('cross-tenant access returns 0 rows', async () => {
  await withTenant(workspaceA, async tx => {
    await tx.insert(tasks).values({ title: 'secret', workspaceId: workspaceA, ... })
  })

  const leaked = await withTenant(workspaceB, async tx =>
    tx.select().from(tasks).where(eq(tasks.title, 'secret'))
  )

  expect(leaked).toHaveLength(0)
})
```

### Target: tenant middleware

> **Триггер ввода:** ≥ 30 endpoint'ов в `/workspaces/[id]/...` с одинаковой extraction-логикой + желание убрать boilerplate из каждого handler'а.

```typescript
// server/middleware/tenant.ts (Target)
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session.userId) return  // unauthenticated routes pass through

  const workspaceId = extractWorkspaceFromPath(event)
  const isMember = await UsersService.belongsToWorkspace(session.userId, workspaceId)
  if (!isMember) throw createError({ statusCode: 403 })

  event.context.workspaceId = workspaceId
})
```

### Target: RLS на `workspaces` и `workspace_members`

> **Триггер ввода:** появление первого реального cross-tenant сценария (например, OAuth-flow, в котором handler идёт в `workspace_members` без явного workspace-context'а) — до этого defence-in-depth уже даёт `findWorkspaceForUser(...)` на уровне сервиса.

Добавить миграцию `0007_workspaces_rls.sql` с политиками для обеих таблиц + RLS-тесты, аналогично `0006_sprints_rls.sql`.

## Observability

### Current

Минимальный — `console.log` в dev для диагностики; в prod пока ничего не настроено. `pino` и `pino-pretty` объявлены в `package.json` (зависимости присутствуют), но **не импортированы** ни в один handler — `grep -r "import.*pino" server/` возвращает пустой результат. Запросы не получают `requestId`, response не возвращает `X-Request-ID` header. Нет ни metrics-endpoint'а, ни Sentry, ни traces.

### Target: structured logging

> **Триггер ввода:** первый деплой на prod-VM (нужно собирать логи в чём-то агрегируемом, минимум — JSON-stream в файл / stdout для systemd journal).

- Подключить `pino` в `server/utils/logger.ts`, инжектить в каждый handler через `event.context.logger`.
- Формат: JSON в prod, `pino-pretty` в dev.
- Обязательные поля: `time`, `level`, `msg`, `requestId`, `userId` (если есть), `workspaceId` (если есть).
- `requestId` middleware: генерирует UUID v4, выставляет в `event.context.requestId` и в response header `X-Request-ID`.

### Target: error tracking (Sentry)

> **Триггер ввода:** первый внешний user, который найдёт баг быстрее тебя; либо появление первого платного клиента (ошибки в проде стоят денег).

Sentry SDK для Nitro, бесплатный tier до 5K событий / месяц. Source maps загружать в CI.

### Target: метрики (Prometheus)

> **Триггер ввода:** появление SLA на API latency, или ≥ 2 реплик Nitro (нужен централизованный сбор метрик), или регулярные жалобы пользователей на «медленно».

- Endpoint `/api/metrics` через `prom-client`.
- Метрики: HTTP latency (histogram), error rate, активные SSE-соединения, queue depth (`pg-boss`, когда появится), DB connection pool usage.
- Dashboard в Grafana или Yandex Monitoring.
- Alerting: error rate > 1 %, latency p95 > 1 с.

### Target: distributed tracing (OpenTelemetry)

> **Триггер ввода:** ≥ 3 сервисов / процессов, между которыми нужно проследить запрос (например: Nitro → pg-boss worker → внешний API). До этого `requestId` в логах достаточно.

OpenTelemetry traces для HTTP-запросов и DB-запросов. Backend: Jaeger или Yandex Cloud Tracing.

## Безопасность

### Current

- **SQL injection** исключено за счёт Drizzle ORM: все параметры через template strings (`sql\`... ${value}\``) и `.values({...})`, никогда не конкатенируются в строку.
- **XSS:** Vue 3 escapes строки в шаблонах по умолчанию (`{{ value }}` всегда экранируется).
- **CSRF:** `SameSite=Lax` на сессионном cookie (отдельных CSRF-токенов нет — Fetch + cookie с `SameSite` достаточно для современных браузеров).
- **Account enumeration на login:** одинаковый ответ при несуществующем email и неверном пароле (см. `server/api/auth/login.post.ts`).
- **Секреты в dev:** `.env` файл, не в git (`.gitignore` покрывает).

### Target: HTTP security headers

> **Триггер ввода:** первый продакшн-деплой за публичным URL.

`Content-Security-Policy`, `Strict-Transport-Security` (HSTS, `max-age=31536000; includeSubDomains; preload`), `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `X-Content-Type-Options: nosniff`. Конфигурируется в Caddyfile (см. [`06-system-architecture.md`](06-system-architecture.md) → Target → Caddy).

### Target: HTTPS / TLS

> **Триггер ввода:** первый продакшн-деплой за публичным URL.

Let's Encrypt через Caddy (ACME-автомат). До этого dev работает по HTTP на localhost, что не требует TLS.

### Target: rate limiting на чувствительных endpoint'ах

> **Триггер ввода:** первый публичный URL (см. также authN-секцию выше). Покрытие: `/auth/login`, `/auth/forgot-password`, `/workspaces/[id]/members` (POST для invite).

### Target: secrets management

> **Триггер ввода:** ≥ 2 окружения (dev + prod) или ≥ 2 человека в команде — момент, когда `.env` файл начинает дублироваться руками.

В prod: env-переменные через systemd-unit или `docker-compose.prod.yml` (`env_file:`), не в репозитории. Secret rotation: документированный процесс. Vault / Yandex Lockbox — отдельный триггер (≥ 5 prod-сервисов или compliance-требование).

### Target: compliance (152-ФЗ)

> **Триггер ввода:** первый российский корпоративный клиент.

- Для on-prem: клиент сам отвечает за инфраструктуру.
- Для SaaS: данные в РФ (Yandex Cloud / VK Cloud), явное уведомление пользователя о месте хранения.
- Endpoints для экспорта и удаления персональных данных пользователя — отдельный триггер (запрос регулятора или GDPR-эквивалентного claim'а).

## Производительность

### Current

#### SLA (наблюдаемые цифры локально, без нагрузочного тестирования)

- Latency API p95 < 500 мс на типовых endpoint'ах в dev (testcontainers Postgres, без сети). В prod не замерено.
- Один Nitro-процесс, один Postgres, один in-process EventEmitter pub/sub для SSE.

#### Оптимизации

- Connection pooling — встроенный pool `postgres-js` (`max=20` по умолчанию).
- Prepared statements — Drizzle использует параметризованные запросы автоматически.
- Индексы на всех query paths, composite-индексы начинаются с `workspace_id`.
- N+1 борется через SQL `JOIN`'ы (`db.select().from(...).leftJoin(...)`), не в service-коде.

### Target: SLA (production)

> **Триггер ввода:** первый платный клиент / первый внешний клиент с ожиданиями uptime'а.

- Доступность: 99.5 % uptime (≈ 3,6 часа downtime / мес).
- Latency API p95: < 200 мс.
- Latency страницы доски (initial load): < 2 с.
- ≥ 100 concurrent SSE-соединений на одну реплику.

### Target: горизонтальное масштабирование

> **Триггер ввода:** появление 2-й реплики Nitro (см. [`06-system-architecture.md`](06-system-architecture.md) → Target → Postgres LISTEN/NOTIFY pub/sub).

In-process EventEmitter заменяется на Postgres LISTEN/NOTIFY; sticky-sessions в reverse-proxy для SSE. До этого 1 реплика покрывает MVP-нагрузку.

## Резервное копирование

### Current

Backup'ов нет. Dev — данные в локальном Postgres-контейнере, теряются при `docker-compose down -v`.

### Target: ежесуточный pg_dump

> **Триггер ввода:** первый деплой с реальными клиентскими данными (после первого внешнего user'а, который положит туда что-то ценное).

- Ежесуточный `pg_dump` → S3-совместимый Object Storage (Yandex Object Storage / MinIO).
- Хранение: 30 дней.
- Restore: документированная процедура, ручной тест раз в месяц.
- Бэкапы шифруются при загрузке (server-side encryption на стороне Object Storage или клиентская AES-256 перед upload'ом).

### Target: WAL-archiving + автотест restore

> **Триггер ввода:** появление SLA на RPO < 24 ч / первый платный клиент с business-critical данными.

- WAL-archiving через `pg_basebackup` + WAL archive (PITR).
- Хранение: 90 дней.
- Restore-test автоматизирован, запускается еженедельно (raise-recovery-DB → smoke-query → drop).
- Кросс-региональная репликация Object Storage — отдельный триггер (compliance / DR-план с географической изоляцией).

## CI/CD

### Current

CI/CD не настроен. `.github/workflows/`, `.gitflic-ci/`, `Dockerfile` (prod) и `docker-compose.prod.yml` в репозитории отсутствуют. Тесты (`vitest` + `@testcontainers/postgresql`, 124 green) запускаются локально через `bun run test`.

### Target: pipeline на push

> **Триггер ввода:** первый коллаборатор / момент, когда «пушнул не в ту ветку» уже больно.

- GitHub Actions (или GitFlic CI как зеркало).
- Pipeline: `bun run typecheck` + `bun run test` + `bun run build` на каждый push в `main`.
- PR pipeline: всё то же + preview-deploy на временный URL.

### Target: prod deploy automation

> **Триггер ввода:** первый платный клиент / частота деплоев ≥ 1 / неделя (когда ручные деплои становятся узким местом).

- Build Docker-образа в CI, push в Yandex Container Registry.
- Deploy на prod-VM через `docker compose pull && docker compose up -d`.
- Health-check перед switch'ом traffic'а (Caddy reverse-proxy).

## Audit

### Current

Отдельной таблицы `audit_log` нет. События задач пишутся в `task_events` (это **не** audit log в compliance-смысле — это event-source для аналитики: `created`, `moved`, `closed`). Auth-события (`login_success`, `login_failure`, `password_changed`) нигде не логируются.

### Target: Enterprise audit log

> **Триггер ввода:** первый Enterprise-клиент с compliance-требованием (152-ФЗ корпоративный заказчик, или ISO 27001 / SOC 2 Type II по запросу).

- Отдельная таблица `audit_log` (event_type, actor_user_id, target_resource, ip, user_agent, occurred_at, payload_jsonb).
- Retention policy: 7 лет для compliance.
- Экспорт в SIEM-системы (CEF, JSON Lines).
- Immutable (append-only); крипто-цепочка хэшей — отдельный триггер (regulator явно требует tamper-evident).

## Feature flags

### Current

Feature flags не реализованы. Таблицы `feature_flags` нет, helper'а `ff.isEnabled(...)` нет. Все features включены глобально.

### Target: minimal feature-flags таблица

> **Триггер ввода:** первая необходимость выкатить фичу частично — например, Monte Carlo forecasting на одном workspace для feedback'а до глобального релиза.

- Таблица `feature_flags` (`name`, `enabled_globally boolean`, `allowed_workspaces uuid[]`).
- Helper `await ff.isEnabled(workspaceId, 'monte_carlo_forecast')` в `server/utils/feature-flags.ts`.
- Управление флагами — через SQL или CLI; UI пока не нужен.

### Target: rollout %, per-user targeting, метрики

> **Триггер ввода:** ≥ 5 активных feature flag'ов одновременно / появление первого A/B-теста, требующего стабильного rollout %.

- Поддержка процент rollout (0–100 %, hash от `userId` для стабильности).
- Per-user targeting (для beta-тестирования).
- Метрики использования каждого флага.
- Admin-UI в Settings.

## Dual-track сводка

| Аспект | Current | Target (с триггером) |
|--------|---------|----------------------|
| AuthN | email/password + signed session cookie (`nuxt-auth-utils`, scrypt) | rate limit + recovery (первый публичный URL) → 2FA / SSO (первый Enterprise-клиент) |
| AuthZ | 5 ролей в коде (`viewer < member < scrum_master < admin < owner`), guard внутри сервисов | middleware extraction (≥ 30 endpoint'ов с одинаковым guard'ом); per-project роли (явный запрос клиента) |
| RLS | FORCE RLS на 6 таблицах из 9; 124 теста | RLS на `workspaces` и `workspace_members` (первый cross-tenant gap-сценарий) |
| Multi-tenancy | `withTenant()` через `set_config(...)` в каждом handler'е | tenant middleware (≥ 30 endpoint'ов) |
| Logs | `console.log` в dev, `pino` объявлен но не подключён | structured `pino` JSON + `requestId` (первый prod-deploy) |
| Metrics / tracing | нет | Prometheus (≥ 2 реплик / SLA) → OTEL (≥ 3 сервисов) |
| Error tracking | нет | Sentry (первый внешний user) |
| Backups | нет | ежесуточный pg_dump (первый user с реальными данными) → WAL + автотест (RPO < 24ч / платный клиент) |
| CI/CD | локальный `bun run test` | GitHub Actions / GitFlic CI (первый коллаборатор) |
| HTTP headers | нет | CSP / HSTS / X-Frame-Options через Caddy (первый prod-deploy) |
| Audit | `task_events` (event-sourcing, не compliance) | отдельная `audit_log` 7 лет (Enterprise compliance) |
| Feature flags | нет | minimal table (первый частичный rollout) → rollout % / UI (≥ 5 флагов) |

## Связанные документы

- [`06-system-architecture.md`](06-system-architecture.md) — обзор системы, Caddy / pg-boss / LISTEN-NOTIFY как Target.
- [`07-domain-model.md`](07-domain-model.md) — схемы таблиц, RLS, точная фиксация 6 / 9.
- [`08-backend-design.md`](08-backend-design.md) — структура `server/`, реализация `withTenant` и RBAC-сервисов.
- [`12-deployment.md`](12-deployment.md) — деплой и секреты в prod.
- [`docs/uml/01-use-case/roles-guide.md`](uml/01-use-case/roles-guide.md) — детальное описание прав 5 ролей.
