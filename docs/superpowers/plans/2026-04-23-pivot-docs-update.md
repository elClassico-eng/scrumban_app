# Pivot Documentation Update: Go → Nuxt Monorepo

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Обновить все документы, UML-диаграммы и memory-файлы проекта, чтобы они отражали смену стека с Go на Nuxt monorepo (Nitro backend).

**Architecture:** Документация обновляется послойно: сначала memory и CLAUDE.md (они читаются первыми в каждой сессии), затем ключевые архитектурные доки, затем UML. Старый Go Phase 0 plan удаляется.

**Tech Stack:** Редактирование Markdown + PlantUML файлов. Без кода, без тестов.

**Spec:** `docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`

---

## Файлы

| Действие | Файл | Тип изменения |
|----------|------|---------------|
| Modify | `docs/memory/project_core_decisions.md` | Стек: Go → Nitro |
| Modify | `/Users/danya/.claude/projects/-Users-danya--------------------scrumban-app/memory/project_core_decisions.md` | Mirror |
| Modify | `CLAUDE.md` | Backend-секция стека |
| Modify | `COMPACT.md` | Статус + стек |
| Rewrite | `docs/08-backend-design.md` | Полностью новый контент |
| Modify | `docs/06-system-architecture.md` | ~15 Go → Nitro замен |
| Modify | `docs/12-deployment.md` | Dockerfile, Makefile, runtime |
| Modify | `docs/11-non-functional.md` | Auth lib, sqlc→Drizzle, slog→pino |
| Modify | `docs/05-mvp-scope-and-roadmap.md` | Phase 0 описание |
| Modify | `docs/README.md` | Стек-строка |
| Modify | `docs/superpowers/specs/2026-04-18-scrumban-platform-design.md` | Стек-секция |
| Modify | `docs/uml/04-component/components.puml` | Go Backend → Nitro Server |
| Modify | `docs/uml/04-component/components.md` | Те же замены текстом |
| Modify | `docs/uml/06-sequence/login.puml` | echo → Nitro, pgx+sqlc → Drizzle |
| Modify | `docs/uml/06-sequence/create-task-sse.puml` | river → pg-boss |
| Modify | `docs/uml/06-sequence/sequences.md` | Стек-упоминания |
| Delete | `docs/superpowers/plans/2026-04-18-phase0-week1-notes-api.md` | Obsolete Go plan |

---

### Task 1: Обновить memory + CLAUDE.md + COMPACT.md

**Files:**
- Modify: `docs/memory/project_core_decisions.md`
- Modify: `/Users/danya/.claude/projects/-Users-danya--------------------scrumban-app/memory/project_core_decisions.md`
- Modify: `CLAUDE.md`
- Modify: `COMPACT.md`

- [ ] **Step 1: Обновить project_core_decisions.md (оба места)**

В обоих файлах найти и заменить блок стека. Новое содержимое секции **Стек**:

```markdown
## Стек (зафиксирован 2026-04-23, замена Go → Nuxt monorepo)

### Причина смены
Solo-разработчик с TS/Vue-фоном и нулевым опытом Go → не может быть автором Go-backend.
Лучше полностью понять TS-монолит, чем наполовину знать Go-сервис.

### Backend (Nitro / Node.js)
- **Nuxt 4 monorepo**: frontend (app/) + backend (server/) в одном проекте
- **Nitro + H3**: HTTP-сервер, файл-роутинг, SSE нативно
- **Drizzle ORM + Drizzle Kit**: type-safe SQL, миграции через SQL-файлы
- **nuxt-auth-utils** + argon2: session cookies, argon2id хэширование
- **pg-boss**: Postgres-очередь фоновых задач (аналог river, без Redis)
- **zod**: валидация + источник OpenAPI-спеки
- **pino**: structured JSON логи (аналог slog)
- **vitest + testcontainers**: тесты с реальным PostgreSQL

### Frontend (без изменений)
- Nuxt 4 SPA (ssr: false), Vue 3, Pinia, TypeScript strict, Tailwind CSS 4 + Nuxt UI v3 (НЕ NextUI)
- Tailwind + Nuxt UI + Inspira UI + vue-bits
- @tanstack/vue-query, ECharts, vuedraggable

### Инфраструктура (без изменений)
- PostgreSQL 16+ с RLS
- Docker + docker-compose
- Caddy (reverse-proxy + TLS)
- GitHub Actions CI/CD
- Yandex Cloud SaaS / MinIO on-prem

### Что НЕ используем
- Не Go (убран 2026-04-23)
- Не Redis / Kafka / RabbitMQ
- Не Kubernetes в MVP
- Не ORM с DSL (Drizzle близок к SQL)
- Не микросервисы (модульный монолит)
- Не ML в продукте (только research appendix диплома)

### Миграция (если понадобится)
Три guardrail'а: frontend не импортирует из server/, бизнес-логика в services/, миграции = SQL-файлы.
При переходе на Go: drizzle/migrations/*.sql → Goose, openapi/scrumban.yaml → oapi-codegen, services/*.ts → Go-пакеты.
```

- [ ] **Step 2: Обновить CLAUDE.md — секцию стека**

Найти `### Backend` и `### Что НЕ используем`. Заменить:

```markdown
### Backend
- **Nuxt 4 monorepo** — frontend (`app/`) + backend (`server/`) в одном проекте.
- **Nitro + H3** — HTTP-сервер, файл-роутинг, SSE нативно.
- **Drizzle ORM + Drizzle Kit** — type-safe SQL, миграции через SQL-файлы.
- **nuxt-auth-utils** + argon2 — session cookies (HTTP-only), argon2id.
- **pg-boss** — Postgres-очередь фоновых задач (без Redis).
- **zod** — валидация + источник OpenAPI-спеки (zod-to-openapi).
- **pino** — structured JSON логи.
- **vitest + @nuxt/test-utils + testcontainers** — тесты.
```

В `### Что НЕ используем` убрать строку про Go и добавить:
```markdown
- **Не Go** — убран в пользу Nuxt monorepo (2026-04-23); причина: solo TS-разработчик.
```

- [ ] **Step 3: Обновить COMPACT.md**

В секции **Моментальный снимок состояния**:

```markdown
### Проект на этапе
**Пивот архитектуры завершён. Документация обновляется.** Go backend заменён на Nuxt monorepo (Nitro). Spec: `docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`. Код ещё не написан — идеальный момент для смены стека.
```

Обновить дату: `**Обновлён:** 2026-04-23.`

В **Что дальше** изменить первый пункт:
```
1. **Phase 0 Week 1** — Nuxt Nitro starter pet-project (план: `docs/superpowers/plans/2026-04-23-phase0-week1-nitro-starter.md`).
```

- [ ] **Step 4: Commit**

```bash
git add docs/memory/project_core_decisions.md CLAUDE.md COMPACT.md
git commit -m "chore: update memory + CLAUDE.md + COMPACT.md for Go→Nitro pivot"
```

---

### Task 2: Переписать docs/08-backend-design.md

**Files:**
- Rewrite: `docs/08-backend-design.md`

- [ ] **Step 1: Записать новый 08-backend-design.md**

Полное содержимое файла:

```markdown
# Backend Design

Scrumban-платформа использует **Nuxt 4 monorepo** — единый проект, где `app/` — это Nuxt 4 SPA-фронтенд, а `server/` — Nitro-бэкенд на Node.js.

> **Версионная политика:** всегда latest stable. Nuxt 4, Vue 3, Tailwind CSS 4, Nuxt UI v3 (НЕ NextUI/HeroUI — те для React). Codegen типов на всех границах слоёв обязателен.

## Почему Nuxt monorepo вместо отдельного сервиса

Solo-разработчик с TypeScript-фоном: полностью понимаешь TS-код → можешь объяснить любое решение на защите. TypeScript end-to-end исключает mental context switch между языками.

Производительность: Node.js выдерживает нагрузку MVP (30+ пользователей/команда, ~десятки команд). Monte Carlo 1 000–10 000 итераций = 50–150 мс в Node. SSE нативен в H3. Фоновые задачи — pg-boss (Postgres-очередь, без Redis).

## Структура проекта

```
scrumban/
├── app/                    # Nuxt frontend (pages, components, composables)
├── server/
│   ├── api/                # HTTP handlers (файл-роутинг Nitro)
│   │   ├── auth/           # login.post.ts, logout.post.ts, session.get.ts
│   │   ├── workspaces/
│   │   ├── boards/
│   │   ├── tasks/
│   │   └── analytics/
│   ├── services/           # бизнес-логика (pure TS-функции)
│   │   ├── tasks.service.ts
│   │   ├── analytics.service.ts
│   │   └── sprints.service.ts
│   ├── db/
│   │   ├── schema/         # Drizzle table definitions
│   │   └── queries/        # типизированные запросы
│   ├── jobs/               # pg-boss worker-функции
│   ├── middleware/         # auth, rbac, tenant
│   └── utils/              # db.ts, boss.ts, logger.ts, session.ts
├── shared/                 # общие типы (Nuxt auto-import)
│   └── types/
├── openapi/
│   └── scrumban.yaml       # сгенерирован из zod-схем, коммитим
└── drizzle/
    └── migrations/         # SQL-файлы от drizzle-kit generate
```

## Стек

| Задача | Библиотека | Обоснование |
|--------|-----------|-------------|
| HTTP-сервер | **Nitro + H3** | Файл-роутинг, auto-import, SSE нативно |
| ORM / DB | **Drizzle ORM + Drizzle Kit** | Близко к SQL, миграции через SQL-файлы |
| Auth | **nuxt-auth-utils** + argon2 | Session cookies, argon2id hash из коробки |
| Background jobs | **pg-boss** | Postgres-очередь без Redis |
| Валидация | **zod** | `readValidatedBody`, источник OpenAPI-спеки |
| OpenAPI | **zod-to-openapi + openapi-typescript** | Code-first: zod → YAML → TS-client |
| Логирование | **pino** | JSON structured logs |
| Тесты | **vitest + @nuxt/test-utils + testcontainers** | Нативный Vite runner, реальный PG |
| Real-time | **H3 createEventStream() + pg LISTEN/NOTIFY** | SSE без WebSocket |

## Слой данных (Drizzle)

Drizzle-схема — точное отражение ER-диаграммы. Пример:

```typescript
// server/db/schema/tasks.ts
export const tasks = pgTable('tasks', {
  id: uuid('id').primaryKey().defaultRandom(),
  workspaceId: uuid('workspace_id').notNull().references(() => workspaces.id),
  title: varchar('title', { length: 255 }).notNull(),
  status: taskStatusEnum('status').notNull().default('backlog'),
  assigneeId: uuid('assignee_id').references(() => users.id),
  closedAt: timestamp('closed_at'),
  reopenedCount: integer('reopened_count').notNull().default(0),
  createdAt: timestamp('created_at').notNull().defaultNow(),
})
```

`drizzle-kit generate` → SQL-файл в `drizzle/migrations/`. RLS-политики — отдельный SQL-файл (Drizzle не управляет политиками, они настраиваются один раз).

DB-клиент инициализируется в `server/utils/db.ts`, Nitro auto-import делает его доступным как `useDB()` во всём `server/`.

## Auth

Session-based через HTTP-only cookie (не JWT). `nuxt-auth-utils` подписывает cookie через `NUXT_SESSION_PASSWORD`. Пароли — argon2id.

```typescript
// server/api/auth/login.post.ts
const { email, password } = await readValidatedBody(event, LoginSchema.parse)
const user = await UsersService.findByEmail(email)
if (!user || !await verifyPassword(user.passwordHash, password))
  throw createError({ statusCode: 401 })
await setUserSession(event, { userId: user.id })
```

RBAC: `server/middleware/auth.ts` читает сессию, достаёт роль из БД, пишет в `event.context.user`. Handlers не занимаются auth напрямую.

## Background jobs (pg-boss)

Postgres-очередь — работает прямо в Nitro-процессе. Инициализация через Nitro plugin:

```typescript
// server/plugins/jobs.ts
export default defineNitroPlugin(async () => {
  const boss = new PgBoss(process.env.DATABASE_URL!)
  await boss.start()
  boss.work('analytics.recalculate', async job => {
    await AnalyticsService.recalculate(job.data.sprintId)
  })
})
```

Отдельный worker-процесс не нужен до Phase 4+.

## Real-time (SSE)

```typescript
// server/api/boards/[id]/stream.get.ts
const stream = createEventStream(event)
const boardId = getRouterParam(event, 'id')
pgClient.query(`LISTEN board_${boardId}`)
pgClient.on('notification', msg => stream.push(msg.payload!))
event.node.req.on('close', () => stream.close())
return stream.send()
```

Frontend: `useEventSource('/api/boards/1/stream')` composable.

## OpenAPI-контракт

Code-first от zod-схем → `openapi/scrumban.yaml` → TS-типы для frontend:

1. `server/api/**` определяют zod-схемы input/output.
2. `scripts/generate-openapi.ts` через `zod-to-openapi` → `openapi/scrumban.yaml`.
3. `openapi-typescript` → `shared/types/api.d.ts`.
4. Frontend импортирует только из `shared/types/`, никогда из `server/`.

## Три guardrail'а для будущей миграции

| Правило | Механизм |
|---------|----------|
| Frontend не импортирует из `server/` | ESLint `no-restricted-imports` |
| Бизнес-логика в `services/`, не в handlers | Handler ≤ 20 строк |
| Migrations = SQL-файлы | `drizzle-kit generate` коммитит SQL |

При переходе на другой стек: `drizzle/migrations/*.sql` → Goose / Flyway, `openapi/scrumban.yaml` → codegen для целевого языка, `server/services/*.ts` → портируются по одному.

## Тестирование

| Тип | Инструмент | Что |
|-----|-----------|-----|
| Unit | vitest | services/, utils/, pure functions |
| Integration | vitest + testcontainers/postgresql | DB queries, RLS, migrations |
| E2E API | @nuxt/test-utils | HTTP handlers end-to-end |

Критические сервисы (tasks, analytics, auth) — TDD.

## Current / Target / Evolution

**Current (MVP, Phase 1–3):** Один Nuxt-процесс, один PostgreSQL, один Docker-контейнер.

**Target (Phase 4–5):** Возможен выделенный worker-процесс для pg-boss, Drizzle остаётся, добавляется connection pool через pgBouncer при необходимости.

**Evolution:** Если нагрузка выйдет за пределы Node.js или понадобится Multi-language team — `openapi/scrumban.yaml` + `drizzle/migrations/` дают чистую точку для миграции на Go/Elixir/Rust без переписывания frontend и схемы БД.
```

- [ ] **Step 2: Commit**

```bash
git add docs/08-backend-design.md
git commit -m "docs: rewrite backend-design for Nuxt monorepo (Nitro + Drizzle + pg-boss)"
```

---

### Task 3: Обновить docs/06-system-architecture.md

**Files:**
- Modify: `docs/06-system-architecture.md`

- [ ] **Step 1: Найти и заменить Go-специфичные упоминания**

Замены (глобально по файлу):

| Было | Стало |
|------|-------|
| `Go backend` / `Go-бэкенд` | `Nitro backend` |
| `Go Backend (1+ реплик)` | `Nitro Server (1+ реплик)` |
| `HTTP API (echo)` | `HTTP API (Nitro)` |
| `Модульный монолит на Go` | `Модульный монолит на Node.js (Nitro)` |
| `river` | `pg-boss` |
| `pgx + sqlc` | `Drizzle ORM` |
| `slog` | `pino` |
| `Go binary` | `Node process` |
| `echo.Context` | `H3 event context` |
| `[08-backend-design.md](08-backend-design.md) — детали Go-бэкенда` | `[08-backend-design.md](08-backend-design.md) — детали Nitro-бэкенда` |

В секции описания компонентов найти блок `### 1. Модульный монолит на Go` и переименовать в `### 1. Nitro Server (Node.js)`.

- [ ] **Step 2: Проверить ASCII-схему**

Найти ASCII-диаграмму с `│    Go Backend (1+ реплик) │` и обновить:

```
│   Nitro Server (1+ реплик) │
│  - HTTP API (H3)            │
│  - SSE hub                  │
│  - tenant middleware (RLS)  │
│  - pg-boss workers          │
```

- [ ] **Step 3: Commit**

```bash
git add docs/06-system-architecture.md
git commit -m "docs: replace Go with Nitro in system architecture"
```

---

### Task 4: Обновить docs/12-deployment.md

**Files:**
- Modify: `docs/12-deployment.md`

- [ ] **Step 1: Обновить Dockerfile секцию**

Найти `# Go бэкенд` Dockerfile и заменить полностью:

```dockerfile
# Nuxt monorepo (frontend + backend)
FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
RUN npm install -g pnpm && pnpm install --frozen-lockfile
COPY . .
RUN pnpm build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.output ./.output
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
```

- [ ] **Step 2: Обновить Makefile секцию**

Найти и заменить Go-команды:

| Было | Стало |
|------|-------|
| `make migrate-up` / `make migrate-down` — goose | `pnpm db:migrate` — drizzle-kit migrate |
| `make sqlc` — генерация Go-кода | `pnpm db:generate` — drizzle-kit generate |
| `make oapi` — Go server interface | `pnpm codegen` — openapi-typescript |
| `make lint` — gofmt + golangci-lint | `pnpm lint` — eslint + prettier |
| `go build ./cmd/api` | `pnpm build` |

- [ ] **Step 3: Обновить runtime-упоминания**

Заменить `Go binary` → `Node process`, убрать упоминания `goroutine`, `GOMAXPROCS`. Если есть секция "Go-специфичная оптимизация" — удалить или заменить на Node.js эквиваленты.

- [ ] **Step 4: Commit**

```bash
git add docs/12-deployment.md
git commit -m "docs: update deployment for Node/Nuxt runtime"
```

---

### Task 5: Обновить docs/11-non-functional.md

**Files:**
- Modify: `docs/11-non-functional.md`

- [ ] **Step 1: Auth секция — обновить библиотеку**

Найти блок про auth. `nuxt-auth-utils` упомянуть как замену прямому Go-хэндлингу. argon2id остаётся — это алгоритм, не библиотека.

Найти `Tenant middleware в Go` (строка ~61, ~73) и заменить:

```markdown
### Tenant middleware (Nitro)

`server/middleware/tenant.ts` устанавливает `SET LOCAL app.workspace_id` в начале каждой транзакции через Drizzle transaction:

```typescript
// server/middleware/tenant.ts
export default defineEventHandler(async event => {
  const session = await getUserSession(event)
  if (!session.userId) return
  event.context.workspaceId = session.workspaceId
})
```

PostgreSQL RLS-политика использует `current_setting('app.workspace_id')` — без изменений.
```

- [ ] **Step 2: Observability секция**

Найти `log/slog` → заменить на `pino`. Найти `pgxpool` → заменить на `postgres-js connection pool`. Найти `sqlc prepared statements` → заменить на `Drizzle parameterized queries`.

- [ ] **Step 3: Performance секция**

Найти `N+1 борется через SQL JOIN'ы, не в Go-коде` → заменить на `не в service-коде`.
Убрать `Connection pooling (pgxpool): min=10, max=100` → заменить на `Connection pooling через postgres-js pool`.

- [ ] **Step 4: SQL injection**

Найти `исключено использованием sqlc` → заменить на `исключено использованием Drizzle (параметризованные запросы)`.

- [ ] **Step 5: Commit**

```bash
git add docs/11-non-functional.md
git commit -m "docs: update non-functional (auth, observability, perf) for Nitro stack"
```

---

### Task 6: Лёгкие правки — roadmap, README, master spec

**Files:**
- Modify: `docs/05-mvp-scope-and-roadmap.md`
- Modify: `docs/README.md`
- Modify: `docs/superpowers/specs/2026-04-18-scrumban-platform-design.md`

- [ ] **Step 1: docs/05-mvp-scope-and-roadmap.md**

Найти Phase 0 описание (строки ~78–82):

```markdown
**Цель:** освоить Go до продуктивного уровня.
- Неделя 1: Tour of Go, основы синтаксиса.
- Неделя 2: простой HTTP API на net/http + echo (in-memory).
- Неделя 3: тот же API на Postgres через pgx + sqlc + goose.
```

Заменить на:

```markdown
**Цель:** освоить Nuxt full-stack (Nitro backend) до продуктивного уровня.
- Неделя 1: Nuxt 4 basics, Nitro server routes, file-based routing.
- Неделя 2: Drizzle + PostgreSQL (Docker), CRUD для notes.
- Неделя 3: auth (nuxt-auth-utils), pg-boss job, vitest + testcontainers.
```

Найти строку риска:
```
| Go учится медленнее ожидаемого | Средняя | Высокое |...
```
Заменить на:
```
| Nitro/Node backend новый для разработчика | Низкая | Среднее | TS знаком, экосистема стандартная |
```

- [ ] **Step 2: docs/README.md**

Найти строку со стеком backend (обычно в таблице или списке). Заменить `Go (echo, pgx, sqlc)` → `Node.js (Nitro, Drizzle, pg-boss)`.

- [ ] **Step 3: master spec (2026-04-18-scrumban-platform-design.md)**

Найти секцию стека. Добавить ссылку на новый pivot spec:

```markdown
> **Стек обновлён 2026-04-23.** Backend переведён с Go на Nuxt monorepo (Nitro).
> Актуальная спека: [`2026-04-23-nuxt-monorepo-pivot.md`](2026-04-23-nuxt-monorepo-pivot.md)
```

Заменить Go-строки в таблице стека на Nitro-строки.

- [ ] **Step 4: Commit**

```bash
git add docs/05-mvp-scope-and-roadmap.md docs/README.md docs/superpowers/specs/2026-04-18-scrumban-platform-design.md
git commit -m "docs: update roadmap, README, master spec stack references"
```

---

### Task 7: Обновить UML — Component diagram

**Files:**
- Modify: `docs/uml/04-component/components.puml`
- Modify: `docs/uml/04-component/components.md`

- [ ] **Step 1: components.puml**

Найти строку 55: `package "Go Backend (монолит)" as GoPkg <<backend>> {`
Заменить на: `package "Nitro Server (Node.js)" as NitroPkg <<backend>> {`

Внутри пакета найти компоненты с Go-специфичными именами:
- Если есть `[echo Router]` → `[H3 Router]`
- Если есть `[sqlc]` → `[Drizzle ORM]`
- Если есть `[river]` → `[pg-boss]`
- Если есть `[slog]` → `[pino]`
- Если есть `[pgxpool]` → `[postgres-js pool]`

- [ ] **Step 2: components.md**

Найти все упоминания `Go backend`, `echo`, `sqlc`, `river`, `slog`, `pgx` и заменить по той же таблице что в Task 3.

- [ ] **Step 3: Commit**

```bash
git add docs/uml/04-component/
git commit -m "uml: update component diagram Go→Nitro"
```

---

### Task 8: Обновить UML — Sequence diagrams

**Files:**
- Modify: `docs/uml/06-sequence/login.puml`
- Modify: `docs/uml/06-sequence/create-task-sse.puml`
- Modify: `docs/uml/06-sequence/sequences.md`

- [ ] **Step 1: login.puml**

Строка 13: `participant "HTTP API\n(echo)" as API`
→ `participant "HTTP API\n(Nitro)" as API`

Строка 16: `participant "Storage\n(pgx+sqlc)" as Storage`
→ `participant "Storage\n(Drizzle)" as Storage`

- [ ] **Step 2: create-task-sse.puml**

Строка 22: `participant "Worker\n(river)" as Worker`
→ `participant "Worker\n(pg-boss)" as Worker`

- [ ] **Step 3: sequences.md**

Найти и заменить:
- `echo` → `Nitro`
- `sqlc` / `pgx` → `Drizzle`
- `river worker` → `pg-boss worker`
- `Go service` → `Nitro service`

- [ ] **Step 4: Commit**

```bash
git add docs/uml/06-sequence/
git commit -m "uml: update sequence diagrams Go→Nitro participant labels"
```

---

### Task 9: Удалить старый Go plan

**Files:**
- Delete: `docs/superpowers/plans/2026-04-18-phase0-week1-notes-api.md`

- [ ] **Step 1: Удалить файл**

```bash
rm docs/superpowers/plans/2026-04-18-phase0-week1-notes-api.md
```

- [ ] **Step 2: Commit**

```bash
git add -A docs/superpowers/plans/
git commit -m "chore: remove obsolete Go Phase 0 Week 1 plan"
```

---

### Task 10: Финальная проверка

- [ ] **Step 1: Найти оставшиеся Go-упоминания в docs/**

```bash
grep -r -l -i "\becho\b\|sqlc\|pgx\|goose\|river\|goroutine\|Go backend\|Go-бэкенд" docs/ --include="*.md" --include="*.puml"
```

Ожидаемый вывод: пусто (или только файлы в `learning/` — они не трогаются).

Если что-то найдено — исправить по месту.

- [ ] **Step 2: Commit финальный**

```bash
git add -A
git commit -m "docs: complete Go→Nitro pivot documentation update"
```
