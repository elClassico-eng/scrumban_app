# 11 — Non-Functional Requirements

## Аутентификация (authN)

### MVP
- **Метод:** email + пароль.
- **Хэширование:** argon2id через `hashPassword()` / `verifyPassword()` из `nuxt-auth-utils`.
- **Сессии:** подписанный HTTP-only cookie с user_id (через `setUserSession()`). Подпись через `NUXT_SESSION_PASSWORD` (256-bit env-секрет).
- **Cookie flags:** `HttpOnly`, `Secure` (в prod), `SameSite=Lax`.
- **TTL:** 7 дней sliding (продлевается при активности), абсолютный лимит 30 дней.
- **Logout:** `clearUserSession(event)` — cookie очищается; для глобальной revoke нужна отдельная таблица `revoked_sessions` (Target).
- **Восстановление пароля:** email-ссылка с токеном, 1 час жизни, одноразовая.
- **Защита от брутфорса:** rate limit на /api/auth/login (5 попыток / 5 мин на email), после превышения — CAPTCHA или блокировка на 15 мин.

### Target
- Опциональный 2FA (TOTP через authenticator-приложения).
- SSO: OAuth 2.0 / OIDC (Yandex ID, GitFlic ID), SAML (для Enterprise).
- Webauthn / Passkeys — опционально после SSO.
- Audit log всех auth-событий.

### Evolution
- 2FA — по запросу клиентов.
- SSO добавляется вместе с первым Enterprise-клиентом.

## Авторизация (authZ) / RBAC

### Роли (MVP)
- **Owner** — создатель workspace'а. Имеет все права, включая удаление.
- **Admin** — управляет членами, проектами, настройками. Не может удалить workspace.
- **Member** — работает с задачами, создаёт, редактирует.
- **Viewer** — только чтение.

### Разрешения (простой matrix, MVP)
| Действие | Owner | Admin | Member | Viewer |
|----------|-------|-------|--------|--------|
| Управлять workspace (settings, plan) | ✓ | − | − | − |
| Приглашать / удалять членов | ✓ | ✓ | − | − |
| Создавать проекты, доски, колонки | ✓ | ✓ | ✓ | − |
| Создавать / редактировать задачи | ✓ | ✓ | ✓ | − |
| Закрывать спринты | ✓ | ✓ | ✓ | − |
| Просматривать аналитику | ✓ | ✓ | ✓ | ✓ |
| Удалять проекты, workspace | ✓ | − | − | − |

### Target
- Пермиссии per-project (user может быть admin в одном проекте и member в другом).
- Кастомные роли (назначаемый набор пермиссий).
- Guest-пользователи (доступ к одной задаче/проекту без членства в workspace).

### Реализация
- Middleware `server/middleware/rbac.ts`: helper `requireRole(event, 'admin')` или `requirePermission(event, 'task.create')`.
- Frontend условно показывает кнопки на основе role из `useAuth()` composable.
- RBAC проверяется **всегда на сервере**, frontend только скрывает UI.

## Multi-tenancy (изоляция данных)

### Модель
Один Postgres, множество Workspace'ов. Изоляция достигается:
1. **`workspace_id` в каждой tenant-scoped таблице.**
2. **Composite индексы всегда начинаются с `workspace_id`.**
3. **Row-Level Security (RLS) в Postgres.** (hard guard)
4. **Tenant middleware в Nitro** — выставляет `SET LOCAL app.workspace_id` в начале каждой транзакции через Drizzle.

### RLS политика (пример)
```sql
ALTER TABLE tasks ENABLE ROW LEVEL SECURITY;

CREATE POLICY tasks_tenant_isolation ON tasks
  USING (workspace_id = current_setting('app.workspace_id', true)::uuid);
```

Эффект: любой SELECT/UPDATE/DELETE автоматически фильтруется по текущему `app.workspace_id`. Забыть WHERE теперь безопасно — Postgres вернёт 0 строк.

### Tenant middleware (Nitro)
```typescript
// server/middleware/tenant.ts
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session.userId) return

  const workspaceId = extractWorkspaceFromPath(event)
  const isMember = await UsersService.belongsToWorkspace(session.userId, workspaceId)
  if (!isMember) throw createError({ statusCode: 403 })

  event.context.workspaceId = workspaceId
})
```

`SET LOCAL app.workspace_id` выставляется в начале каждой транзакции через Drizzle helper в `server/utils/db.ts`:

```typescript
export async function withTenant<T>(workspaceId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    await tx.execute(sql`SET LOCAL app.workspace_id = ${workspaceId}`)
    return fn(tx)
  })
}
```

### Тест безопасности (обязателен в CI)
```typescript
// tests/integration/rls.test.ts
it('cross-tenant access returns 0 rows', async () => {
  await withTenant(workspaceA, async tx => {
    await tx.insert(tasks).values({ title: 'secret', workspaceId: workspaceA })
  })

  const leaked = await withTenant(workspaceB, async tx => {
    return tx.select().from(tasks).where(eq(tasks.title, 'secret'))
  })

  expect(leaked).toHaveLength(0)
})
```

## Observability

### Structured logging
- `pino` (Node.js standard для structured JSON logs).
- Формат JSON в prod, человекочитаемый (`pino-pretty`) в dev.
- Обязательные поля: `time`, `level`, `msg`, `requestId`, `userId` (если есть), `workspaceId` (если есть), `traceId` (если есть).
- Уровни: DEBUG (только dev), INFO, WARN, ERROR.

### Request tracing
- Middleware добавляет `request_id` в context и response header `X-Request-ID`.
- `request_id` логируется на всех уровнях обработки запроса.

### MVP metrics
- Простые счётчики через stdout (INFO лог на завершение запроса с latency).

### Target metrics
- Prometheus endpoint `/api/metrics`: HTTP latency (histogram), error rate, active SSE connections, queue depth (pg-boss), DB connection pool usage.
- Dashboard в Grafana (или Yandex Monitoring).
- Alerting на основные пороги (error rate >1%, latency p95 >1s).

### Error tracking
- **MVP:** stdout лог с stacktrace (ERROR level).
- **Target:** Sentry. Бесплатный tier до 5K событий/месяц.

### Tracing
- **Target:** OpenTelemetry traces для HTTP запросов и DB запросов.
- Backend: Jaeger или Yandex Cloud Tracing.

## Безопасность

### Защита данных в покое
- Пароли: argon2id.
- Пользовательские вложения: Object Storage с включённым encryption at rest.
- БД: шифрование на уровне диска VM.
- Бэкапы: шифруются при загрузке в Object Storage.

### Защита данных в транспорте
- HTTPS везде (Let's Encrypt через Caddy).
- HSTS включён.

### Защита от типовых атак
- **SQL injection:** исключено использованием Drizzle (все параметры через template strings, никогда не конкатенируются в строку).
- **XSS:** Vue 3 escapes по умолчанию, content-security-policy headers через Caddy.
- **CSRF:** SameSite=Lax на сессионном cookie; отдельных CSRF токенов нет (Fetch+cookie с SameSite достаточно).
- **Clickjacking:** X-Frame-Options: DENY.
- **Rate limiting:** на чувствительных endpoint'ах (login, invite, password reset).

### Секреты
- Все секреты через env-переменные.
- В dev: `.env` файл (не в git).
- В prod: подаются через systemd-unit или docker-compose env_file, которые не лежат в репозитории.
- Secret rotation: документирован процесс, но автоматизация — LATER.

### Compliance (152-ФЗ)
- Для on-prem: клиент сам отвечает за инфраструктуру.
- Для SaaS: данные хранятся в РФ (Yandex Cloud / VK Cloud), явное уведомление пользователя о хранении данных.
- Процесс экспорта и удаления данных пользователя: API endpoint'ы (LATER, но закладываем архитектурно).

## Производительность

### SLA (target)
- Доступность: 99.5% uptime (≈ 3.6 часов downtime/мес).
- Latency API p95: <200ms.
- Latency страницы доски (initial load): <2s.

### Текущие MVP-цели
- Latency API p95: <500ms.
- Работает при 100 concurrent SSE-соединениях на одну реплику.

### Оптимизации
- Connection pooling (`postgres-js` встроенный pool): max=20 на инстанс по умолчанию.
- Prepared statements (Drizzle использует параметризованные запросы автоматически).
- Индексы на всех query paths.
- N+1 борется через SQL JOIN'ы (`db.select().from(...).leftJoin(...)`), не в service-коде.

## Резервное копирование

### MVP
- Ежесуточный `pg_dump` → Object Storage (Yandex).
- Хранение: 30 дней.
- Восстановление: документированная процедура, ручной тест раз в месяц.

### Target
- Ежечасные WAL-бэкапы (через pg_basebackup + WAL archive).
- Хранение: 90 дней.
- Restore-test автоматизирован, запускается еженедельно.
- Object Storage бэкапы с кросс-региональной репликацией.

## Audit

### MVP
- События с флагом `is_audit` в общей таблице `events`.
- Доступ к audit-логу: только owner/admin.

### Target (Enterprise)
- Отдельная таблица `audit_log`.
- Retention policy (7 лет для compliance).
- Экспорт в SIEM-системы (CEF, JSON).
- Immutable (append-only, с крипто-цепочкой хэшей — если потребуется).

## Feature flags

### MVP
- Таблица `feature_flags`: `name`, `enabled_globally`, `allowed_workspaces`.
- Helper `await ff.isEnabled(workspaceId, 'monte_carlo_forecast')`.
- UI для управления флагами — отдельный admin-endpoint, без красивого UI (SQL или CLI).

### Target
- UI для управления флагами в Admin-панели.
- Поддержка «процент rollout» (0-100%).
- Поддержка per-user targeting (для beta-тестирования).
- Метрики использования каждого флага.

## Dual-track сводка

| Аспект | Current (MVP) | Target |
|--------|---------------|--------|
| AuthN | email/password + signed session cookie (nuxt-auth-utils) | + 2FA, SSO (OAuth/SAML) |
| AuthZ | 4 фикс. роли | per-project, кастомные роли |
| RLS | включён везде с 1 дня | включён + тесты |
| Logs | pino JSON | + Sentry + OTel |
| Metrics | INFO-логи | Prometheus + Grafana |
| Backups | ежесуточный pg_dump | WAL + еженедельный restore test |
| Audit | events + is_audit | отдельная audit_log, 7y retention |
| Feature flags | БД + хелпер | UI + rollout % |

## Связанные документы
- [`06-system-architecture.md`](06-system-architecture.md) — обзор
- [`07-domain-model.md`](07-domain-model.md) — схемы таблиц
- [`08-backend-design.md`](08-backend-design.md) — middleware реализация
- [`12-deployment.md`](12-deployment.md) — secrets в prod