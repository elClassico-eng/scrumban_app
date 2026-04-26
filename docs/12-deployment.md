# 12 — Deployment & CI/CD

## Обзор

Единый `docker-compose.yml` поднимает всю систему. Используется локально для разработки, на staging-среде Yandex Cloud VM — для демо и первых пользователей, и у клиентов при on-prem развёртывании. Одни и те же образы, разные конфигурации.

## Сервисы в Docker Compose

```yaml
services:
  caddy:
    # TLS, reverse-proxy, sticky sessions для SSE
  app:
    # Nuxt 4 monorepo (Nitro server отдаёт и API, и SPA static)
  postgres:
    # PostgreSQL 16
  minio:
    # S3-compat storage (для on-prem и dev; в SaaS — Yandex Object Storage)
```

> **Примечание:** один Nitro-процесс обслуживает и `/api/*` (HTTP handlers), и SPA (Nuxt build). Отдельных контейнеров для frontend/backend нет — это и есть выгода monorepo.

## Локальная разработка

### Первый запуск
```bash
git clone https://gitflic.ru/project/<owner>/scrumban.git
cd scrumban
cp .env.example .env                 # редактируем по необходимости
docker compose -f docker-compose.dev.yml up -d   # Postgres + MinIO
pnpm install
pnpm db:migrate                      # применить миграции
pnpm dev                             # запустить Nuxt dev-сервер (frontend + Nitro backend)
```

### Dev workflow
```bash
# Терминал 1: инфра (БД и storage в Docker)
docker compose -f docker-compose.dev.yml up -d

# Терминал 2: Nuxt dev-сервер с HMR (один процесс отдаёт и SPA, и API)
pnpm dev
```

Открываем http://localhost:3000. Frontend и backend живут в одном процессе — никаких отдельных портов и proxy.

### npm scripts (вместо Makefile)
- `pnpm dev` — Nuxt dev-сервер (HMR для frontend, hot-reload для backend).
- `pnpm build` — production-сборка (генерит `.output/` готовый к деплою).
- `pnpm db:generate` — `drizzle-kit generate` создаёт SQL-миграцию из изменений в schema.
- `pnpm db:migrate` — `drizzle-kit migrate` применяет pending миграции.
- `pnpm db:studio` — Drizzle Studio (GUI для БД).
- `pnpm openapi:generate` — собрать `openapi/scrumban.yaml` из zod-схем.
- `pnpm codegen` — `openapi-typescript` обновляет `shared/types/api.d.ts`.
- `pnpm test` — `vitest run` (unit + integration + e2e).
- `pnpm lint` — eslint + prettier check.

## CI/CD (GitHub Actions — или GitFlic CI)

### Pipeline на PR
1. **lint** — eslint + prettier (TS), `pnpm typecheck` (tsc --noEmit).
2. **test-unit** — vitest unit-тесты (services, utils, pure functions).
3. **test-integration** — vitest + @testcontainers/postgresql (реальный PG в Docker).
4. **test-e2e** — @nuxt/test-utils для HTTP handler-ов.
5. **contract-test** — Schemathesis сверяет реализацию с `openapi/scrumban.yaml` (Target).
6. **rls-guard-test** — проверка cross-tenant isolation.
7. **build** — Docker image (без push).

Если всё зелёное — PR можно мёржить.

### Pipeline на main branch
1. Все шаги PR pipeline.
2. **push** — Docker images пушатся в registry (Yandex Container Registry / Docker Hub / GitFlic Container Registry).
3. **deploy-staging** — SSH на staging VM, `docker compose pull && docker compose up -d`, health check.
4. **notify** — Telegram/Slack уведомление о деплое.

### Release (tag)
1. Все шаги main pipeline.
2. **deploy-production** — с манжетой (confirm step).

## Среды (environments)

### Local (dev)
- Postgres и MinIO в Docker.
- Nuxt dev-сервер локально (один процесс на frontend + Nitro backend) с HMR.
- `.env` содержит dev-креды.

### Staging (Yandex Cloud VM, наш SaaS для демо)
- Одна VM 2 vCPU / 4 GB / 40 GB SSD (~1000 ₽/мес).
- Docker Compose со всеми сервисами.
- Отдельный домен (например, `staging.scrumban.ru`).
- Sandbox-данные для демо.

### Production (после защиты, когда нужно)
- VM Yandex Cloud (или VK Cloud / Selectel).
- Отделённая БД (отдельная VM или Managed PostgreSQL).
- Object Storage: Yandex Object Storage.
- Домен: scrumban.ru (или подобный).
- Monitoring: Sentry + Yandex Monitoring.

### On-prem (клиент разворачивает у себя)
- Клиент клонирует публичный репозиторий (или получает tarball).
- Заполняет `.env` своими значениями.
- Запускает `docker compose up -d`.
- Всё поднимается на его инфраструктуре. Мы не видим данные.

## Конфигурация через env-переменные

Общий паттерн — все сервисы конфигурируются через env, без хардкода.

Пример `.env`:
```
# PostgreSQL
POSTGRES_PASSWORD=change_me
DATABASE_URL=postgresql://scrumban:change_me@postgres:5432/scrumban

# Nitro / Nuxt session
NUXT_SESSION_PASSWORD=long_random_string_at_least_32_chars
NUXT_HOST=0.0.0.0
NUXT_PORT=3000

# Object Storage (S3-compat)
OBJECT_STORAGE_ENDPOINT=http://minio:9000
OBJECT_STORAGE_BUCKET=scrumban
OBJECT_STORAGE_ACCESS_KEY=minioadmin
OBJECT_STORAGE_SECRET_KEY=minioadmin

# Email (для уведомлений)
EMAIL_SMTP_HOST=smtp.yandex.ru
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=...
EMAIL_SMTP_PASSWORD=...

# Logging
LOG_LEVEL=info

# Caddy
DOMAIN=scrumban.local
```

## Миграции в deployment

### Подход
- Миграции запускаются **при старте Nitro-плагина** (автоматически в MVP) или вручную через `pnpm db:migrate` перед деплоем.
- Drizzle Kit проверяет версию БД (через `__drizzle_migrations` таблицу), применяет недостающие миграции up-ward.
- Если стартует несколько реплик — advisory lock на уровне БД предотвращает гонки.

### Rollback-стратегия
- Drizzle не генерирует down-миграции автоматически. Откат — отдельный SQL-файл, написанный вручную.
- Откат только для последних нескольких версий; для старых — через точечные манипуляции.
- Продакшн-rollback НЕ автоматизирован в MVP; требует ручного вмешательства.

## Бэкапы

### MVP
- Cron job в VM: `pg_dump` раз в сутки → загрузка в Object Storage.
- Срок хранения: 30 дней (cleanup cron).
- Ручное восстановление (документировано).
- Object Storage бэкапится автоматически провайдером.

### Target
- Ежечасные WAL-бэкапы через `pgbackrest` или `pg_basebackup`.
- Cross-регион репликация в Object Storage.
- Автоматический restore-test еженедельно на отдельной VM.

## Мониторинг и алерты

### MVP
- `pino` JSON-логи в `stdout` → journald → Yandex Cloud Logging.
- Health endpoint'ы `/api/healthz` (live) и `/api/readyz` (с проверкой БД) в Nitro.
- Простая uptime-проверка (uptimerobot или скрипт на cron).

### Target
- Sentry для ошибок (frontend + backend).
- Yandex Monitoring / Prometheus для метрик.
- Alert policy: error rate >1%, p95 latency >1s, disk usage >80%, backup failure.
- Уведомления — Telegram/Pachca (сами используем свои же интеграции).

## Безопасность инфраструктуры

- SSH на VM только по ключу, пароли отключены.
- Firewall: открыты только 80/443 (HTTPS через Caddy) и SSH (ограничен по IP).
- Postgres — слушает только на localhost или через Docker network.
- Object Storage — доступ только из backend через IAM policy.
- Регулярные обновления OS (через Yandex Cloud / apt unattended-upgrades).

## HTTPS (Let's Encrypt)

Caddy делает всё автоматически:
```
scrumban.ru {
    reverse_proxy app:3000

    # Sticky sessions для SSE (когда появятся 2+ реплики)
    @sse path /api/v1/workspaces/*/stream
    reverse_proxy @sse app:3000 {
        lb_policy cookie sticky_id
    }
}
```

Один upstream — Nitro процесс отдаёт и API, и SPA static. В Target (2+ реплики) Caddy балансирует между ними; sticky cookie гарантирует, что SSE-клиент остаётся на той же реплике.

## Dual-track сводка

| Аспект | Current (MVP) | Target |
|--------|---------------|--------|
| Среды | local + staging | + production + on-prem |
| CI/CD | GitHub Actions с build/test/push | + auto-deploy + contract tests |
| Hosting | 1 VM (всё на одной) | VM backend + отдельная DB + CDN |
| Бэкапы | pg_dump ежедневно | WAL + weekly restore test |
| Monitoring | journald + uptime check | Sentry + Prometheus + Alerts |
| Secrets | .env на VM | + vault / Yandex Lockbox |
| HTTPS | Let's Encrypt через Caddy | + HSTS preload |
| Scaling | single Nitro process | 2+ реплики Nitro за балансером + отдельный pg-boss worker |

## Стоимость (обновлённая сводка)

### MVP staging
- Yandex Cloud VM: ~1000 ₽/мес.
- Object Storage: ~20 ₽/мес.
- Домен: ~200 ₽/год.
- **Итого: ~1050 ₽/мес.**

### Target production (до 100 команд)
- VM backend + VM DB: ~2500 ₽/мес.
- Object Storage + CDN: ~200 ₽/мес.
- Sentry: free tier (до ~5K событий/мес).
- **Итого: ~2800 ₽/мес.**

### Target production (при масштабировании)
- Yandex Managed PostgreSQL: ~6000 ₽/мес.
- 2×VM backend: ~2500 ₽/мес.
- CDN + Object Storage: ~500 ₽/мес.
- Sentry paid plan: ~$26/мес ≈ ~2500 ₽/мес.
- **Итого: ~11500 ₽/мес.**

## Связанные документы
- [`06-system-architecture.md`](06-system-architecture.md) — компоненты
- [`08-backend-design.md`](08-backend-design.md) — Nitro backend
- [`09-frontend-design.md`](09-frontend-design.md) — frontend-сборка
- [`11-non-functional.md`](11-non-functional.md) — безопасность, backups