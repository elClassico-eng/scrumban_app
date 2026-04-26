# 08 — Backend Design

## Подход

Backend реализуется на Go с **прогрессивной сложностью**: начинаем с минимального набора концепций, которые автор может освоить и понимать, наращиваем слои только когда они реально нужны. Целевая архитектура — production-grade модульный монолит; начальная архитектура — «работающий API и ничего лишнего».

## Current (MVP, месяцы 1–3)

### Структура пакетов
```
backend/
├── cmd/server/main.go          # точка входа: wiring, старт HTTP, graceful shutdown
├── api/openapi.yaml            # контракт (single source of truth) — минимальный в MVP
├── db/
│   ├── migrations/*.sql        # goose миграции
│   └── queries/*.sql           # sqlc исходники
├── internal/
│   ├── config/                 # загрузка env
│   ├── domain/                 # pure-типы: Task, Sprint, User
│   ├── storage/                # sqlc-generated + транзакционные обёртки
│   ├── auth/                   # пароли (argon2id), сессии в cookie
│   ├── handlers/               # HTTP-функции (тонкие)
│   └── middleware/             # logging, auth
├── go.mod / go.sum
├── Dockerfile
└── Makefile
```

### Пять вещей, которые нужно понимать в первый месяц

1. **HTTP handler (echo):** функция с сигнатурой `func(c echo.Context) error`. Читает тело, вызывает storage, возвращает JSON.
2. **sqlc:** пишешь SQL в `.sql` файле с комментарием `-- name: CreateTask :one`, запускаешь `sqlc generate`, получаешь Go-функцию `CreateTask(ctx, params)`. Никаких ORM.
3. **Миграции (goose):** файлы `001_create_users.sql`, `002_create_workspaces.sql`. Команда `goose up` применяет все новые; `goose down` откатывает одну.
4. **Cookies для auth:** при логине ставим cookie `session=<token>`, на каждом запросе middleware читает cookie и кладёт user_id в context.
5. **Docker для dev:** один `docker-compose.yml`, поднимает Postgres (потом — и backend).

### Библиотеки (MVP minimal)
- `github.com/labstack/echo/v4` — HTTP роутер.
- `github.com/jackc/pgx/v5` — Postgres driver.
- `github.com/pressly/goose/v3` — миграции.
- `github.com/sqlc-dev/sqlc` — codegen из SQL.
- `github.com/golang-migrate` — альтернатива goose, на выбор.
- `log/slog` (стандартная библиотека) — структурированный логинг.
- `github.com/stretchr/testify` — тесты.
- `github.com/cosmtrek/air` — live reload в dev.

### Авторизация в MVP
- Argon2id для хэширования паролей (готовая библиотека `github.com/alexedwards/argon2id` или `crypto/argon2`).
- Сессии: random-token в cookie, hash в таблице `sessions`.
- Expire: 7 дней sliding (продлевается при активности).
- Logout: revoke token в БД.

### Пример handler'а (illustrative)
```go
// internal/handlers/tasks.go
func (h *Handlers) CreateTask(c echo.Context) error {
    var req CreateTaskReq
    if err := c.Bind(&req); err != nil {
        return c.JSON(400, ErrorResp{"invalid_body"})
    }
    userID := c.Get("user_id").(uuid.UUID)
    workspaceID := c.Get("workspace_id").(uuid.UUID)
    task, err := h.Storage.CreateTask(c.Request().Context(), db.CreateTaskParams{
        WorkspaceID: workspaceID,
        Title:       req.Title,
        ReporterID:  userID,
        // ...
    })
    if err != nil {
        return c.JSON(500, ErrorResp{"internal"})
    }
    return c.JSON(201, task)
}
```

Ничего больше. Три слоя — middleware, handler, storage. Этого достаточно на месяц.

### Тесты в MVP
- Unit-тесты на чистые функции (расчёты, маппинг).
- Handler-тесты с test Postgres в Docker (поднимается в CI одной командой).
- Покрытие: 50–60% достаточно, не гонимся за метрикой.

## Target (к защите)

### Обогащённая структура
```
internal/
├── config/
├── domain/                # pure types, sentinel errors
├── storage/
│   ├── sqlc_gen/          # codegen (не трогаем)
│   └── tx.go              # транзакции
├── auth/
├── middleware/
│   ├── logging.go
│   ├── recovery.go
│   ├── authn.go
│   ├── tenant.go          # SET app.workspace_id для RLS
│   └── rbac.go
├── api/                   # handlers (тонкие)
├── services/              # бизнес-логика (толстые, mock'аемые)
├── events/                # in-process bus + publisher
├── sse/                   # SSE hub + LISTEN/NOTIFY интеграция
├── analytics/             # CFD, Monte Carlo, Little's Law, percentiles
├── jobs/                  # river workers
├── ff/                    # feature flags
└── oapi_gen/              # oapi-codegen generated
```

### Ключевые паттерны
- **Dependency injection через конструкторы:** `NewTasksService(storage, events, ff)`. Без DI-контейнеров.
- **Интерфейсы на границах:** `services` определяет `TasksRepo`, `storage` реализует. Это даёт mock'и в тестах.
- **Context первым аргументом:** `ctx context.Context` везде. Таймауты, cancel, request-scoped values.
- **Sentinel-ошибки в domain:** `ErrNotFound`, `ErrForbidden`, `ErrConflict`, `ErrWIPBreached`, `ErrTenantScope`. Helper `httperr.Write(w, err)` мапит в коды.
- **Дисциплина импортов:** `api` → `services` → `storage` → `domain`. Никаких обратных импортов. Проверяется `go-arch-lint` в CI.

### OpenAPI-first workflow
1. Меняешь `api/openapi.yaml`.
2. `make oapi` → `oapi-codegen` обновляет `internal/oapi_gen/` (server interface + types).
3. Go-компилятор показывает, какие handler'ы не реализованы.
4. `make types` → `kubb` обновляет `frontend/lib/api/` (TS-клиент).
5. `make contract-test` → Schemathesis сверяет реализацию со spec.

### Расширенные тесты
- Unit + Integration (testcontainers-go с реальным Postgres).
- Contract (Schemathesis).
- Snapshot (analytics).
- **RLS guard test** в CI (попытка cross-tenant доступа → 0 строк).
- Load (k6) — перед защитой для главы о производительности.

### Библиотеки (Target добавки к MVP)
- `github.com/riverqueue/river` — фоновые задачи на Postgres.
- `github.com/deepmap/oapi-codegen/v2` — OpenAPI → Go types/server.
- `github.com/testcontainers/testcontainers-go` — реальный Postgres в тестах.
- `github.com/fe3dback/go-arch-lint` — проверка правил импортов.
- `github.com/schemathesis/schemathesis` (через CLI) — contract testing.

## Evolution

### Путь из Current в Target
1. **Когда `handlers/` начинает разбухать** → выделить `services/` и переносить логику.
2. **Когда появляется 2+ разных реакции на одно изменение** (например, нужно и SSE-broadcast, и webhook) → ввести event bus.
3. **Когда появляется 2+ реплики бэкенда** → Postgres LISTEN/NOTIFY для SSE.
4. **Когда ручное поддержание типов между Go и TS начинает раздражать** → OpenAPI-codegen.
5. **Когда baseline нагрузка аналитики начинает замедлять OLTP** → вынести analytics-workers в отдельный процесс (тот же бинарь, другой subcommand).
6. **Когда команда разрастается** → `go-arch-lint` становится обязательным.

### Сигналы «пора рефакторить»
- Файл `>500 строк` — время разбивать.
- Handler `>50 строк` — бизнес-логика в `services/`.
- «Этот код я видел где-то в другом месте» — помощник в отдельный файл.
- Тесты стали долго гоняться — вынести интеграционные в отдельный набор.

## Обработка ошибок

### Sentinel errors (domain)
```go
var (
    ErrNotFound      = errors.New("not found")
    ErrForbidden     = errors.New("forbidden")
    ErrConflict      = errors.New("conflict")
    ErrValidation    = errors.New("validation")
    ErrWIPBreached   = errors.New("wip limit exceeded")
    ErrTenantScope   = errors.New("cross-tenant access")
)
```

### Обёртывание
```go
task, err := h.Storage.GetTask(ctx, id)
if err != nil {
    return fmt.Errorf("get task %s: %w", id, err)
}
```

### Мапинг HTTP
Один helper `httperr.Write(c, err)`:
- `errors.Is(err, domain.ErrNotFound)` → 404
- `errors.Is(err, domain.ErrForbidden)` → 403
- `errors.Is(err, domain.ErrValidation)` → 422
- default → 500 + лог

### Логирование
Только на границе (в handler через middleware). В services и storage — только return.

## Observability

### MVP
- Structured logs via `slog` (JSON).
- Request IDs в middleware (добавляется к каждому лог-сообщению).
- Basic metrics: количество запросов, latency (Prometheus-style, опционально).

### Target
- Sentry для ошибок.
- OpenTelemetry traces для ключевых операций.
- Dashboards: p50/p95/p99 latency, error rate, DB query time.

## Связанные документы
- [`06-system-architecture.md`](06-system-architecture.md) — компоненты
- [`07-domain-model.md`](07-domain-model.md) — схема БД
- [`09-frontend-design.md`](09-frontend-design.md) — клиент
- [`10-analytics-design.md`](10-analytics-design.md) — analytics engine
- [`11-non-functional.md`](11-non-functional.md) — RLS, RBAC, auth