# COMPACT — состояние проекта

Этот файл поддерживается в актуальном состоянии. Если ты читаешь его после компакта контекста или новой сессии — здесь точка входа: что сделано, где остановились, куда двигаемся.

**Обновлён:** 2026-05-10.

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
- **RLS**: RLS на 6 таблиц из 9 (boards, board_columns, tasks, task_events, sprints, sprint_tasks) с FORCE ROW LEVEL SECURITY + WITH CHECK; 7 RLS-isolation тестов. `workspaces` + `workspace_members` — известное отставание (см. Backlog).
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

### 2026-05-10 — Docs/code sync (план [`docs/superpowers/plans/2026-05-10-docs-code-sync.md`](docs/superpowers/plans/2026-05-10-docs-code-sync.md))

После аудита (`docs/audit-2026-05-10-issues.md`) обнаружено ~150 расхождений между документацией и реализацией. Стратегия: **код — реальность, документация догоняет**; всё реально нереализованное помечено как Target с измеримым триггером ввода.

**Архив:**
- `docs/archive/` создана; перенесены [Go-spec](docs/archive/2026-04-18-scrumban-platform-design.md) и [Phase 0 plan](docs/archive/2026-04-23-phase0-week1-nitro-starter.md) с migration header'ами как материал для главы «Эволюция архитектуры» в магистерской.

**Numbered docs (12 файлов):** [`07-domain-model.md`](docs/07-domain-model.md), [`06-system-architecture.md`](docs/06-system-architecture.md), [`11-non-functional.md`](docs/11-non-functional.md), [`08-backend-design.md`](docs/08-backend-design.md), [`09-frontend-design.md`](docs/09-frontend-design.md), [`10-analytics-design.md`](docs/10-analytics-design.md), [`05-mvp-scope-and-roadmap.md`](docs/05-mvp-scope-and-roadmap.md) — все переведены в формат Current (что реально работает в коде) + Target (что обоснованно отложено с триггером). Точечные правки в [`01-vision-and-goals.md`](docs/01-vision-and-goals.md), [`04-economic-rationale.md`](docs/04-economic-rationale.md), [`12-deployment.md`](docs/12-deployment.md). [`02-target-audience.md`](docs/02-target-audience.md), [`03-competitive-analysis.md`](docs/03-competitive-analysis.md) — без drift.

**Master spec:** [pivot-spec](docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md) структура папок аннотирована (реализовано / Target).

**Code comments:** `users.ts`, `register.post.ts`, `db.ts` — устаревшие claims (`argon2id` → `scrypt`, `SET LOCAL` → `set_config`).

**UML (7 диаграмм после reset'а):**
- Use case (главная, без per-role) с `<<Future>>` стереотипом для нереализованных UC.
- Class diagram (9 entities + 5 enums) — single source of truth для domain + persistence (ER папка удалена).
- **Package diagram (NEW)** — модульная организация, acyclic dependency claim.
- Component diagram (Current only — Target живёт в bottom-note + 06-system-architecture.md).
- 2 sequence diagrams: create-task-SSE + Monte Carlo (login убран).
- 2 state machines: task-lifecycle, sprint-lifecycle.
- Удалены: `03-er/`, `05-deployment/`, `01-use-case/per-role/`, `06-sequence/login.puml`.

**Verified facts** (greppable в коде, согласованы word-for-word через все docs):
- 9 таблиц БД; RLS на 6 таблиц из 9 (boards, board_columns, tasks, task_events, sprints, sprint_tasks); `users` глобальная, `workspaces` + `workspace_members` — известное отставание.
- 5 RBAC ролей (`viewer < member < scrum_master < admin < owner`).
- 3-state sprint enum (`planned/active/closed`, без отдельного `cancelled` состояния — отмена через shortcut `planned → closed`).
- 7 task_event_type values; specialized event log (не универсальная `events`).
- ~44 HTTP endpoint'ов; 124 теста зелёные.
- Auth: scrypt (не argon2id) через nuxt-auth-utils.
- Analytics: live-SQL без MV/cache; `MIN_DAYS_OF_HISTORY = 14`, `DEFAULT_ITERATIONS = 1000`, `HISTORY_LOOKBACK_DAYS = 90`.
- Frontend: skeleton (`app.vue` + `pages/index.vue`); все pages/composables/stores — Phase 4.

**Накопленная память** (новые feedback-записи в [`docs/memory/`](docs/memory/)):
- [English commits convention](docs/memory/feedback_english_commits.md).
- [Verify concrete claims with grep](docs/memory/feedback_verify_concrete_claims.md) — paid lesson после RLS-overclaim, sprint cancellation drift и Nuxt UI drift.

**Эффект:** документация теперь честно отражает реализацию; всё откладываемое имеет триггер ввода. На защите комиссия может грепать кодом любой числовой claim в docs — он совпадёт.

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

## Что дальше

**Phase 4 — Frontend MVP** (триггер: docs/code sync завершён).

Roadmap из [`09-frontend-design.md`](docs/09-frontend-design.md) → Target → Phase 4 implementation roadmap:
1. Auth flow — `/auth/login`, `/auth/register`. `useAuth()` composable. Pinia auth-store.
2. Workspace + Board view — drag-n-drop задач (vuedraggable), real-time SSE (`useBoardStream` поверх `@vueuse/core` `useEventSource`), WIP-индикаторы.
3. Task detail panel.
4. Analytics dashboard — CFD, throughput, Monte Carlo card, cycle-time scatter, Little's Law рекомендации (ECharts).
5. Sprint planning UI.
6. Settings + Members — RBAC management UI (5 ролей).

Параллельно: подключить отсутствующие deps (Pinia, vue-query, ECharts, vuedraggable, vee-validate, Inspira UI, vue-bits, @nuxt/icon, @nuxt/google-fonts, @vueuse/core), настроить codegen pipeline (zod-to-openapi → openapi-typescript → `shared/types/api.d.ts`).

**Phase 5 — Production-readiness** (триггер: Phase 4 завершена, MVP готов к показу).

См. [`05-mvp-scope-and-roadmap.md`](docs/05-mvp-scope-and-roadmap.md) → Phase 5: Dockerfile, Caddyfile, docker-compose.prod, pino + requestId, Sentry, CI (typecheck + vitest + build), pg_dump → Object Storage, rate limit на /auth/login, CSP/HSTS.

---

## Backlog (mini-PRs до / во время Phase 4-5)

Обнаружено во время docs/code sync (2026-05-10) — мелкие задачи, не блокирующие Phase 4, но требующие закрытия до production.

**Database integrity:**
- `task_events.task_id` `ON DELETE CASCADE` → `SET NULL` + snapshot in payload. Триггер: первое hard-delete задачи в проде, потеря истории станет реальной болью. См. [`07-domain-model.md`](docs/07-domain-model.md) → Quirks → task_events.
- RLS на `workspaces` и `workspace_members` (известное отставание — Phase 1 не покрыло). Триггер: первый клиент с >1 workspace, где утечка через эти таблицы — реальный риск.

**Race conditions:**
- `assertNotLastOwner` — добавить `SELECT ... FOR UPDATE` для защиты от concurrent demotion двух последних owner'ов.
- `deleteSprint` — атомарная проверка `state != 'active'` (currently — read-then-delete без lock).

**Convention drift:**
- `pnpm` vs `bun` — реально используется bun (`bun.lock` в репо), но docs (08, 11, pivot-spec, plan) пишут `pnpm`. Cross-cutting sweep — найти все упоминания `pnpm dev/test/build/install`, заменить на `bun run` / `bun test` / `bun install`. Триггер: первый коллаборатор споткнётся.
- `archived_at` на `tasks` — Task 12 (Class diagram) обнаружил, что в коде нет колонки `archived_at`; архивирование через `column_role='archived'` + `task_archived` event. Возможно [`07-domain-model.md`](docs/07-domain-model.md) всё ещё содержит false claim — проверить и поправить.

**Pre-Phase 4 prep:**
- Создать `app/components/`, `app/composables/`, `app/stores/`, `app/lib/` (пустые folder structure).
- Установить frontend deps пакетным `bun install` (Pinia + vue-query + vuedraggable + ECharts + vee-validate + @nuxt/icon + @nuxt/google-fonts + @vueuse/core + Inspira UI + vue-bits).
- Настроить CSS palette (CSS custom properties для dark theme).

**Pre-Phase 5 prep:**
- Создать `Dockerfile`, `docker-compose.prod.yml`, `Caddyfile`.
- Настроить GitHub Actions (typecheck + vitest + build).

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
