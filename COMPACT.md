# COMPACT — состояние проекта

Этот файл поддерживается в актуальном состоянии. Если ты читаешь его после компакта контекста или новой сессии — здесь точка входа: что сделано, где остановились, куда двигаемся.

**Обновлён:** 2026-05-01.

---

## Моментальный снимок состояния

### Проект на этапе
**Backend MVP полностью готов (Phases 1-3). 124 теста зелёные. User уходит на ревью кода.**

Стек:
- Nuxt 4 monorepo (`app/` фронт + `server/` Nitro бек в одном проекте)
- PostgreSQL 16 + Row-Level Security (две роли: `scrumban` для миграций, `scrumban_app` для рантайма)
- Drizzle ORM + drizzle-kit (миграции в SQL)
- nuxt-auth-utils (session cookies + scrypt)
- zod (валидация)
- pino (structured logs, не интегрирован в endpoints — TODO)
- vitest + @nuxt/test-utils + testcontainers/postgresql

### Что работает end-to-end
- **Auth**: register / login / logout / session (4 endpoint, 11 тестов)
- **Workspaces**: CRUD + cross-tenant isolation (3 endpoint, 9 тестов)
- **Workspace members**: list / add / patch role / delete с full RBAC matrix (4 endpoint, 13 тестов)
- **Boards**: CRUD внутри workspace (5 endpoint, 17 тестов)
- **Columns**: CRUD + bulk reorder + 4 default columns при создании board (5 endpoint, 14 тестов)
- **Tasks**: CRUD + position auto-assignment в колонке (5 endpoint, 12 тестов)
- **Move task**: state machine (closed_at / reopened_count), task_events log, WIP enforcement с force=true override (1 endpoint, 9 тестов)
- **Sprints**: CRUD + state machine planned→active→closed + sprint_tasks M:N (10 endpoint, 16 тестов)
- **SSE real-time**: GET /stream endpoint, in-process event bus (4 unit-теста + smoke-test вручную)
- **Analytics**:
  - Throughput (по дню/неделе)
  - Cycle time (с min-sample threshold для перцентилей)
  - CFD (Cumulative Flow Diagram)
  - **Monte Carlo** прогноз спринтов (B+ научная новизна)
  - **Little's Law** WIP рекомендации (B+ научная новизна)
- **RLS**: 8 tenant-scoped таблиц с FORCE ROW LEVEL SECURITY + WITH CHECK; 7 RLS-isolation тестов
- **Multi-tenancy**: service-layer scoping + RLS как defence-in-depth

### Последнее выполненное действие
17 коммитов реализации (Phases 1-3) за активную сессию. 124 теста проходят. User просил «продолжим backend и Phase 3, потом я буду смотреть, анализировать и давать правки».

### Следующий шаг
**User берёт паузу для ревью кода.** Когда вернётся — вероятные направления:
1. Frontend (Nuxt SPA) — login / dashboard / boards UI / kanban view с drag-n-drop / analytics charts
2. Доработка по результатам ревью (refactoring, clarifications, fixes)
3. Phase 4 hardening — pg-boss workers (когда появятся email/notifications), per-column cycle time, Postgres LISTEN/NOTIFY для multi-replica SSE

---

## Что сделано (commits, в порядке создания)

### Документация и pivot (до active development)
- Project setup (`.gitignore`, `.claude/settings.json`, `CLAUDE.md`, `COMPACT.md`)
- Полная документация (`docs/01-12-*.md`, `docs/uml/`, master spec)
- Pivot Go → Nuxt monorepo (`docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`)
- Docs updated under pivot (08-backend-design rewrite, system-arch, deployment, etc.)
- Roles guide расширен с разъяснениями (роль ≠ должность)
- README updated

### Phase 1 backend (steps 1-7) — auth + workspaces foundation
- Step 1: Nuxt 4 skeleton, package.json, nuxt.config.ts, app/app.vue
- Step 2: Drizzle, docker-compose с Postgres :5433, /api/healthz
- Step 3: 4 auth endpoint через nuxt-auth-utils
- Step 4: workspaces CRUD
- Step 5: vitest + @nuxt/test-utils, 20/20 e2e тестов
- Step 6: doc fixes (scrypt вместо argon2id, RLS отложен в Phase 2)
- Step 7: workspace member management с RBAC

### Phase 2 backend (steps 8-13) — boards + tasks + real-time
- Step 8: Phase 2 schema (boards, board_columns, tasks, task_events) + RLS politik + two-role Postgres setup + RLS isolation tests
- Step 9: boards CRUD endpoints
- Step 10: columns CRUD + reorder + default columns при создании board
- Step 11: tasks CRUD
- Step 12: move-task endpoint с state machine (closed_at / reopened_count) + task_events writes + WIP enforcement
- Step 13: SSE real-time + in-process event bus

### Phase 3 backend (steps 15-17) — sprints + analytics
- Step 14 SKIPPED: pg-boss workers (YAGNI без актуальных фоновых задач)
- Step 15: sprints schema + state machine + sprint_tasks M:N + RLS
- Step 16: throughput + cycle-time analytics + task_created event log
- Step 17: CFD + Monte Carlo + Little's Law

---

## Что в процессе / на паузе

- ⏸ **Frontend** — Nuxt UI, vue-bits, ECharts. Полностью отложен до завершения backend ревью. Когда возвращаемся — collaborative подход (Claude предлагает, user адаптирует).
- ⏸ **pg-boss** — фоновые задачи. Поднимем когда появится первая настоящая background-задача (email уведомления, ML агрегаты).
- ⏸ **Postgres LISTEN/NOTIFY** — нужно для SSE при 2+ репликах. Phase 4.
- ⏸ **per-column cycle time** для более точных WIP recommendations. Phase 4.
- ⏸ **Email-based invitations** (с magic-link токеном). Phase 4.
- ⏸ **OpenAPI codegen** (zod-to-openapi → openapi-typescript). Полезно когда будем писать frontend, но не блокер.
- ⏸ **Deployment diagram** UML — был отложен по решению user.

---

## Что дальше (после ревью user'а)

### Самое вероятное направление: Frontend
- Composable `useCurrentUser` (обёртка над useUserSession)
- Auth pages: /login, /register
- Dashboard с workspaces list, переключение workspace
- Kanban доска: draggable columns + tasks (vuedraggable)
- Sprint view: список, planning UI, attach/detach task
- Analytics dashboard: CFD chart, throughput trend, Monte Carlo карточка с числом «X% probability», WIP recommendations таблица
- SSE composable: подписка на /api/.../stream, обновление Pinia store

### Долгосрочно (весь roadmap)
Из `docs/05-mvp-scope-and-roadmap.md`:
- Phase 4–5 (месяцы 4–6): B+ углубление + multi-tenancy hardening (per-column cycle, OpenAPI contract, observability)
- Phase 6 (месяц 7): research-эксперимент с ML + текст диплома
- Phase 7 (месяцы 8–9): production polish + защита

---

## Структура реального кода (после Phase 3)

```
scrumban_app/
├── app/
│   ├── app.vue                       ← <UApp> + <NuxtPage />
│   └── pages/index.vue               ← заглушка "Skeleton is up"
├── server/
│   ├── api/
│   │   ├── auth/                     ← register, login, logout, session
│   │   ├── healthz.get.ts
│   │   └── workspaces/
│   │       ├── index.{get,post}.ts
│   │       └── [id]/
│   │           ├── members/          ← list/add/patch/delete
│   │           ├── boards/
│   │           │   ├── index.{get,post}.ts
│   │           │   └── [boardId]/
│   │           │       ├── columns/  ← CRUD + reorder
│   │           │       ├── tasks/    ← CRUD + move + events
│   │           │       ├── sprints/  ← CRUD + start/close + sprint_tasks
│   │           │       ├── analytics/← throughput, cycle-time, cfd, monte-carlo, wip-recommendations
│   │           │       └── stream.get.ts ← SSE
│   ├── services/                     ← users, workspaces, workspace-members,
│   │                                  boards, columns, tasks, sprints, analytics
│   ├── db/
│   │   └── schema/                   ← users, workspaces, boards, tasks, sprints (всё RLS-managed где tenant)
│   ├── plugins/                      ← (пока пусто; pg-boss plugin будет тут)
│   └── utils/
│       ├── auth.ts                   ← requireAuth helper
│       ├── db.ts                     ← useDB() singleton + withTenant() для RLS
│       ├── errors.ts                 ← domain errors + toHttpError + Zod handler
│       ├── events.ts                 ← in-process pub/sub для SSE
│       └── rbac.ts                   ← role hierarchy + requireMinRole / strictlyOutranks
├── shared/types/auth.d.ts            ← #auth-utils type augmentation
├── drizzle/migrations/               ← 7 SQL миграций (генерируемые drizzle-kit)
├── db/init/01_app_role.sql           ← Postgres init: создаёт scrumban_app role
├── docker-compose.dev.yml            ← Postgres 16 на :5433
├── tests/                            ← 12 test файлов, 124 тестов
└── docs/                             ← всё что было раньше + pivot spec
```

---

## Ключевые архитектурные решения для ревью

1. **Two-role Postgres** (`scrumban` super для миграций, `scrumban_app` non-super для рантайма) — чтобы FORCE ROW LEVEL SECURITY реально применялся (super bypassит RLS неявно).
2. **NULLIF guard в RLS политиках** — `current_setting('app.workspace_id', true)` возвращает '' (не NULL) после `SET LOCAL`; без NULLIF получаем `''::uuid` ошибку.
3. **withTenant() helper** — единственный путь к tenant-scoped queries; вне его RLS возвращает 0 строк (защита по дизайну).
4. **task_events append-only log** — фундамент для аналитики; createTask пишет `task_created`, moveTask пишет `task_moved` / `task_closed` / `task_reopened` / `task_archived`.
5. **State machine в moveTask** — closed_at и reopened_count синхронны с переходами через 'done' колонку. Reopen считается только если task был реально закрыт (closedAt != null), иначе просто move.
6. **Reorder через парковку (PARKING_POSITION = 1_000_000)** — обходит unique constraint на (board_id, position) во время bulk обновления.
7. **In-process event bus для SSE** — Phase 4 расширим LISTEN/NOTIFY когда появятся 2+ реплики.
8. **Min-sample thresholds в analytics** — percentiles возвращают null при <5 образцов; Monte Carlo возвращает insufficient_data при 0 закрытых задачах.

---

## Контекст user

- **Даня** — магистрант ВолГУ, делает scrumban как дипломный проект, solo.
- **Frontend-сильный** (Nuxt/Vue/TS), backend пишет Claude.
- **Хочет понимать**, что Claude делает в backend — через краткие комментарии и объяснения, не через самостоятельное написание.
- **Делает senior-grade критику архитектуры** — ML был заменён на статистику не случайно.
- **Имеет PlantUML plugin в IDE** — SVG в `learning/` не генерируем.
- **Обращение на «ты»**, русский язык, коммиты на английском.

---

## Регулярные обновления

**Этот файл должен обновляться после каждого значимого куска работы.** Минимум:
- Пополнить список «Что сделано».
- Обновить «Что дальше».
- Обновить дату в заголовке.
