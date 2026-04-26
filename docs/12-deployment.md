# 12 — Deployment & CI/CD

## Обзор

Единый `docker-compose.yml` поднимает всю систему. Используется локально для разработки, на staging-среде Yandex Cloud VM — для демо и первых пользователей, и у клиентов при on-prem развёртывании. Одни и те же образы, разные конфигурации.

## Сервисы в Docker Compose

```yaml
services:
  caddy:
    # TLS, reverse-proxy, sticky sessions для SSE
  nuxt:
    # Nuxt SPA (production build) + BFF
  backend:
    # Go бэкенд
  postgres:
    # PostgreSQL 16
  minio:
    # S3-compat storage (для on-prem и dev; в SaaS — Yandex Object Storage)
```

## Локальная разработка

### Первый запуск
```bash
git clone https://gitflic.ru/project/<owner>/scrumban.git
cd scrumban
cp .env.example .env                 # редактируем по необходимости
make dev                             # поднимает Postgres + MinIO
```

### Dev workflow
```bash
# Терминал 1: только БД и storage
docker compose -f docker-compose.dev.yml up -d

# Терминал 2: backend с live reload
cd backend && air                    # или make backend-dev

# Терминал 3: frontend HMR
cd frontend && npm run dev           # или make frontend-dev
```

Nuxt прокси `/api/*` → `http://localhost:8080` (backend).

### Makefile targets
- `make dev` — запуск всего для разработки.
- `make migrate-up` / `make migrate-down` — goose миграции.
- `make sqlc` — генерация Go-кода из SQL.
- `make oapi` — генерация Go server interface из OpenAPI.
- `make types` — генерация TS-клиента из OpenAPI.
- `make test` — запуск всех тестов.
- `make build` — сборка Docker-образов.
- `make lint` — gofmt + golangci-lint + go-arch-lint.

## CI/CD (GitHub Actions — или GitFlic CI)

### Pipeline на PR
1. **lint** — gofmt, golangci-lint, eslint, prettier.
2. **test-backend** — unit + integration (testcontainers-go с Postgres).
3. **test-frontend** — vitest unit tests.
4. **contract-test** — Schemathesis сверяет реализацию с OpenAPI spec (Target).
5. **rls-guard-test** — проверка cross-tenant isolation.
6. **build** — Docker images (без push).

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
- Backend и Nuxt — локальные процессы с live reload.
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
DB_DSN=postgres://scrumban:change_me@postgres:5432/scrumban?sslmode=disable

# Backend
BACKEND_PORT=8080
SESSION_SECRET=long_random_string
OBJECT_STORAGE_ENDPOINT=http://minio:9000
OBJECT_STORAGE_BUCKET=scrumban
OBJECT_STORAGE_ACCESS_KEY=minioadmin
OBJECT_STORAGE_SECRET_KEY=minioadmin
EMAIL_SMTP_HOST=smtp.yandex.ru
EMAIL_SMTP_PORT=587
EMAIL_SMTP_USER=...
EMAIL_SMTP_PASSWORD=...

# Frontend
NUXT_PUBLIC_API_BASE=http://localhost:8080  # в prod: /api
NUXT_HOST=0.0.0.0
NUXT_PORT=3000

# Caddy
DOMAIN=scrumban.local
```

## Миграции в deployment

### Подход
- Миграции запускаются **при старте backend'а** (автоматически в MVP).
- Goose проверяет версию БД, применяет недостающие миграции up-ward.
- Если стартует несколько реплик — advisory lock предотвращает гонки.

### Rollback-стратегия
- `down`-миграции пишутся для каждого `up`.
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
- `stdout` логи → journald → Yandex Cloud Logging.
- Health endpoint'ы `/healthz` и `/readyz` у backend и Nuxt.
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
    reverse_proxy /api/* backend:8080
    reverse_proxy nuxt:3000
    
    # Sticky sessions для SSE
    @sse path /api/v1/workspaces/*/stream
    reverse_proxy @sse backend:8080 {
        lb_policy cookie sticky_id
    }
}
```

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
| Scaling | single instance | 2+ реплик backend за балансером |

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
- [`08-backend-design.md`](08-backend-design.md) — backend-деплой
- [`09-frontend-design.md`](09-frontend-design.md) — frontend-сборка
- [`11-non-functional.md`](11-non-functional.md) — безопасность, backups