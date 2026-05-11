# COMPACT — состояние проекта

Этот файл поддерживается в актуальном состоянии. Если ты читаешь его после компакта контекста или новой сессии — здесь точка входа: что сделано, где остановились, куда двигаемся.

**Обновлён:** 2026-05-11.

---

## Моментальный снимок состояния

### Проект на этапе
**Phase 4 frontend MVP смержен в `main` (`452c01c`). Full SPA от auth до analytics работает в браузере, browser e2e пройдена на каждом Step. Backend без изменений с Phase 3, 124 теста по-прежнему зелёные.**

Стек:
- **Backend** (без изменений): Nuxt 4 monorepo (`server/` Nitro) + PostgreSQL 16 + RLS + Drizzle ORM + nuxt-auth-utils (scrypt) + zod + pino + vitest + testcontainers
- **Frontend** (новое): Nuxt 4 SPA (`app/`) + Nuxt UI v4 (Reka UI + Tailwind 4) + Pinia + @tanstack/vue-query + ECharts (через vue-echarts) + vuedraggable + @vueuse/core + slugify
- **Tooling**: bun + drizzle-kit + docker-compose (Postgres :5433 dev) + `scripts/codesign-natives.sh` (postinstall — macOS Tahoe Gatekeeper workaround)

### Что работает end-to-end (frontend, верифицировано в браузере)
- **Auth flow**: register → auto-login → workspace; login с error mapping (401); logout очищает vue-query cache; глобальный `auth.global.ts` middleware гонит на `/login` при отсутствии сессии; reload сохраняет сессию через cookie.
- **Workspaces**: список карточек с role badge; create modal с **auto-slug** из name (cyrillic через `slugify` lib: «Моя команда» → `moya-komanda`); switcher в sidebar с **localStorage persist** через `@vueuse/core` `useStorage`; clickable cards → `/workspaces/{id}/boards`.
- **Members**: invite по email (только зарегистрированных), role change через USelect (только роли строго ниже актора), remove с подтверждением; error mapping (404 not registered, 409 already member, 400 last-owner-protection); RBAC в UI зеркалит backend `requireMinRole`.
- **Boards**: список grid карточек, create modal (admin+) с auto-slug, hover-trash delete (admin+).
- **Kanban-доска**: горизонтальный scroll колонок, **DnD через vuedraggable@4** с optimistic update (`qc.setQueryData` патчит cache до ответа сервера; на success/error — invalidate для server-renumbered позиций); WIP badge становится **красным** на превышении лимита.
- **Task drawer (USlideover)**: inline-edit title/description через `watchDebounced` 500ms, priority/column через USelect; **audit timeline** из task_events с iconified per-event-type; delete с confirm.
- **Realtime SSE**: подписка через `@vueuse/core` `useEventSource` на `/stream`, на любой event (`task.created/moved/updated/deleted`) **инвалидирует** `['tasks', wsId, boardId]`; две вкладки видят изменения друг друга через ~1 сек.
- **Sprints**: state machine UI (planned → active → closed), action buttons по правам (scrum_master+) и state; 409 на конкурирующий active sprint → понятная ошибка; filter по state.
- **Analytics dashboard** (5 ECharts визуализаций):
  - **CFD** (stacked area) — накопленный поток задач по колонкам.
  - **Cycle Time** (scatter + p50/p85/p95 reference lines + stats grid).
  - **Throughput** (line, задач/день).
  - **Monte Carlo** (P50/P85/P95 days + probability badge + histogram распределения daily throughput, user-tunable tasksRemaining/horizonDays).
  - **WIP recommendations** (Little's Law: per-column current vs recommended с delta-arrow).
  - Insufficient-data branches (MC и WIP возвращают `{ok: false}`) рендерятся отдельным empty state.
  - Dark mode переключает ECharts theme через `colorMode` binding.
- **RBAC в UI**: `hasRole(actorRole, minRole)` хелпер; кнопки create/manage скрыты / задизейблены ниже порога.

### Backend (без изменений с Phase 3, как было в прошлом снимке)
- 44 HTTP endpoint'а (auth + workspaces + members + boards + columns + tasks + sprints + analytics + healthz + stream).
- 9 таблиц БД; RLS на 6 (boards, board_columns, tasks, task_events, sprints, sprint_tasks); `users` глобальная, `workspaces` + `workspace_members` — known gap.
- 124 теста зелёные (12 файлов).
- 5 RBAC ролей (viewer < member < scrum_master < admin < owner), 3-state sprint enum (planned/active/closed), 7 task_event_type.
- Auth: scrypt через nuxt-auth-utils. Analytics: live-SQL без кэша; `MIN_DAYS_OF_HISTORY=14`, `DEFAULT_ITERATIONS=1000`, `HISTORY_LOOKBACK_DAYS=90`.

### Последнее выполненное действие
Phase 4 frontend MVP смержен в `main` (`452c01c`). 17 коммитов: 4 feature-Step + foundation chores + 2 follow-up. Также удалена локальная ветка `feature/phase4-frontend` (и старая `docs/code-sync-2026-05-10`).

### Следующий шаг
**Phase 5 — Production-readiness.** Trigger: Phase 4 в `main`, MVP готов к демо/защите. См. [`05-mvp-scope-and-roadmap.md`](docs/05-mvp-scope-and-roadmap.md) → Phase 5 секция.

Главные направления:
1. **Dockerfile** для production (multi-stage: bun install → bun build → runtime).
2. **docker-compose.prod.yml** — Nuxt app + Postgres 16 + Caddy reverse proxy.
3. **Caddyfile** — TLS via Let's Encrypt, security headers (HSTS, CSP, X-Frame-Options).
4. **pino integration в endpoints** — structured logs с requestId middleware.
5. **Sentry** — error tracking (front + back).
6. **GitHub Actions CI** — typecheck + vitest + build.
7. **pg_dump** scheduled backup → Yandex Object Storage.
8. **Rate limit** на `/auth/login`.
9. **Deployment** на Yandex Cloud VM с docker-compose.

---

## Что сделано (commits, в порядке создания)

### Документация и pivot (до active development)
- Project setup (`.gitignore`, `.claude/settings.json`, `CLAUDE.md`, `COMPACT.md`).
- Полная документация (`docs/01-12-*.md`, `docs/uml/`, master spec).
- Pivot Go → Nuxt monorepo.

### Phase 1 backend — auth + workspaces foundation
- 4 auth endpoint через nuxt-auth-utils, workspaces CRUD, RBAC member management, 124 теста в pipeline.

### Phase 2 backend — boards + tasks + real-time
- boards CRUD, columns CRUD + reorder + default 4 колонки при создании board, tasks CRUD + move state machine + WIP enforcement, task_events append-only log, SSE через in-process event bus.

### Phase 3 backend — sprints + analytics
- sprints state machine + sprint_tasks M:N, throughput + cycle-time, CFD + Monte Carlo + Little's Law WIP recommendations.

### 2026-05-10 — Docs/code sync
- Большой sweep: 12 numbered docs + master spec + UML reset (7 диаграмм, ER/per-role/login.puml удалены), память расширена двумя feedback'ами (English commits, verify concrete claims). Эффект: документация теперь greppable-консистентна с кодом.

### Phase 4 frontend MVP (2026-05-11) — *новое*
17 коммитов на `feature/phase4-frontend` → смержено в main одним merge-commit'ом.

**Step 0 — Foundation** (8 chore/setup коммитов):
- Spec doc как единый источник Phase 4 (`docs/superpowers/specs/2026-05-10-phase4-frontend.md`).
- `pnpm` → `bun` sweep в backend docs (08, 11, 12, pivot-spec).
- Phase 4 deps: pinia + @pinia/nuxt, @tanstack/vue-query, vuedraggable@4, echarts + vue-echarts, @vueuse/core, @nuxt/icon, @nuxtjs/google-fonts, slugify, vue-tsc (devDep). vee-validate был установлен но позже удалён.
- Nuxt UI v4 theme (`app.config.ts`: indigo primary, slate neutral), Manrope + JetBrains Mono fonts, vue-query plugin.
- **Routing manifest** (`app/routing/index.ts`): 30 apiRoutes (покрывают все 44 backend endpoint'а) + 10 pageRoutes; единственное место с литералами `/api/` и frontend pages.
- App shell layout (sidebar + header + auth layout), shared types (Role, SprintState, TaskPriority, TaskEventType), utilities (humanize, format).
- Refactor: shell-компоненты `AppHeader`/`AppSidebar` перенесены в `components/` root (без префикса).
- `scripts/codesign-natives.sh` postinstall — макОС Tahoe Gatekeeper SIGKILL'ит unsigned native binaries (esbuild, fsevents, lightningcss, и т.д.), скрипт ad-hoc re-sign'ит через `codesign -s -`.

**Step 1 — Auth flow** (`187f96d`):
- `useAuthApi` composable: sessionQuery (retry:false на 401) + login/register/logout мутации. На logout — `qc.clear()` (дропает весь cache, не только сессию — следующий user не должен видеть чужие workspaces из кэша).
- `auth.store` (Pinia setup syntax) — тонкая обёртка над sessionQuery: computed `user`, `isAuthenticated`, `isLoading`.
- `auth.global` middleware — `.global.ts` авто-привязка ко всем routes; PUBLIC_ROUTES whitelist (home, login, register); `sessionQuery.suspense()` ждёт первый fetch перед редиректом (иначе loop на пустых данных).
- LoginForm / RegisterForm — `<UForm :schema :state>` Nuxt UI native (zod схема напрямую, без vee-validate); 401 / 409 error mapping через computed errorMessage в `<UAlert>`.
- AppHeader получает logout button + email юзера.

**Step 2 — Workspaces & boards navigation** (`81a98b5`):
- `useWorkspacesApi`, `useBoardsApi(wsId)`, `useMembersApi(wsId)` composables (CRUD + invalidation).
- `workspace.store` с `useStorage<string|null>('scrumban:current-workspace', null)` — currentId переживает reload.
- `WorkspaceSwitcher` в sidebar через `<UDropdownMenu>` с separator + "Create workspace" footer item.
- Create modals: auto-slug из name через `slugify` lib (с cyrillic transliteration), typed-once heuristic (после ручного редактирования slug фиксируется).
- Members page: список с MemberRoleBadge, USelect для role change (только роли строго ниже актора), remove с confirm; error mapping 400 last-owner-protection / 409 already member / 404 not registered.
- Sidebar links становятся context-aware: при выбранном workspace появляются Boards + Members links.

**Step 3 — Board view + tasks + SSE + DnD** (`ed55439`):
- `useColumnsApi`, `useTasksApi`, `useTaskEventsApi` composables.
- `useTaskMove(wsId, boardId)` — domain composable: `qc.setQueryData` для optimistic update + `move.mutate` + invalidate на error/success (сервер может renumber позиции соседей при insert/remove).
- `useBoardSse(wsId, boardId)` — `@vueuse/core` `useEventSource` на 4 event names (`task.created/moved/updated/deleted`) + autoReconnect; на любой event просто invalidate `['tasks', wsId, boardId]`.
- `board.store` — `openTaskId` для drawer state (не prop-drilling, любая TaskCard может открыть).
- `BoardColumn` (vuedraggable wrapper, обрабатывает только `added/moved` на destination — `removed` парится с `added` через cross-column drag), `TaskCard` (compact), `TaskDrawer` (USlideover с `watchDebounced` 500ms inline-edit), `TaskEventTimeline`.
- Board page: горизонтальный grid колонок, group tasks by columnId с sort by position.

**Step 4 — Sprints & analytics** (`4eb65e8`):
- `useSprintsApi(wsId, boardId)` (CRUD + start/close transitions), `useSprintTasksApi`, `useAnalyticsApi` (4 фиксированные queries + `monteCarlo(params)` factory для caller-driven params).
- `app/plugins/echarts.client.ts` — tree-shaken `use([CanvasRenderer, LineChart, BarChart, ScatterChart, CustomChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent, TitleComponent])`.
- Sprint components: StateBadge, SprintCard (action buttons по state и role), CreateModal с date pickers.
- 5 analytics chart components (см. секцию выше).
- `BoardSubnav` — shared header для трёх sub-pages с tabs Board/Спринты/Аналитика.
- Spec drift fix: MC errors не через 422 (как писала спека), а через `{ok: false}` discriminated union в успешном ответе.

**Follow-ups** (после Step 4):
- `773ea96` — `bun remove vee-validate @vee-validate/zod` (0 импортов в коде, заменили нативным `<UForm :schema :state>`).
- `717edf3` — align spec §10 с backend реальностью (displayName drop, SessionResponse non-nullable user, retry:false, форма пример переписан под Nuxt UI native).
- `e0f03ce`, `d03ee12`, `9d0c5c8` — memory entries: IDE-review preference, Nuxt component auto-import prefix gotcha (bit me twice), no Co-Authored-By trailer going forward.

**Merge:** `452c01c Merge branch 'feature/phase4-frontend' into main` (no-ff, 83 files changed, 5127+/55-).

---

## Что в процессе / на паузе

- ⏸ **pg-boss workers** — фоновые задачи. Поднимем когда появится первая настоящая background-задача (email уведомления, periodic aggregates).
- ⏸ **Postgres LISTEN/NOTIFY** — нужно для SSE при 2+ репликах. Phase 5 hardening, текущий in-process event bus покрывает single-instance.
- ⏸ **Email-based member invitations** (с magic-link токеном) — backend сейчас принимает только уже зарегистрированных по email. Phase 5+.
- ⏸ **OpenAPI codegen pipeline** (zod-to-openapi → openapi-typescript) — триггер: ≥3 type drift'а с backend ИЛИ ручное обновление типов >1 раза в неделю. Сейчас 0 drift'ов, типы вручную в `shared/types/`.
- ⏸ **per-column cycle time** для более точных WIP recommendations.
- ⏸ **Deployment UML diagram** — отложен по решению user.

---

## Что дальше

**Phase 5 — Production-readiness.**

Roadmap из [`docs/05-mvp-scope-and-roadmap.md`](docs/05-mvp-scope-and-roadmap.md) → Phase 5:

1. **Dockerfile** — multi-stage build (bun → server bundle → distroless или alpine runtime).
2. **docker-compose.prod.yml** — Nuxt app + Postgres 16 + Caddy + (опц.) Postgres backup sidecar.
3. **Caddyfile** — automatic TLS via Let's Encrypt, security headers (HSTS, CSP, X-Frame-Options, Referrer-Policy).
4. **pino integration в server/api/*** — structured JSON logs с requestId middleware, integrated в каждый event handler.
5. **Sentry** — `@sentry/nuxt` для фронта, `@sentry/node` для server-side. DSN из env.
6. **GitHub Actions CI** — `.github/workflows/ci.yml`: typecheck + vitest (с testcontainers postgres) + build.
7. **pg_dump scheduled backup** → Yandex Object Storage (через cron внутри docker-compose или отдельный sidecar).
8. **Rate limit на /auth/login** — slow-down после 5 неудачных попыток, blocking после 10 (in-memory или Postgres-based).
9. **Deployment на Yandex Cloud VM** (или MaxVM): caddy + docker compose up.

---

## Backlog (mini-PRs — до / во время Phase 5)

Обнаружено во время docs/code sync (2026-05-10) и Phase 4 — мелкие задачи, не блокирующие, но требующие закрытия до production.

**Database integrity:**
- `task_events.task_id` `ON DELETE CASCADE` → `SET NULL` + snapshot в payload. Триггер: первое hard-delete задачи в проде, потеря истории станет реальной болью.
- RLS на `workspaces` и `workspace_members` (известное отставание — Phase 1 не покрыло). Триггер: первый клиент с >1 workspace, где утечка через эти таблицы — реальный риск.

**Race conditions:**
- `assertNotLastOwner` — `SELECT ... FOR UPDATE` для защиты от concurrent demotion двух последних owner'ов.
- `deleteSprint` — атомарная проверка `state != 'active'` (сейчас read-then-delete без lock).

**Convention drift:**
- Проверить `07-domain-model.md` на наличие false claim про `archived_at` колонку (архивирование через `column_role='archived'` + `task_archived` event, не stored timestamp).

**Frontend backlog (Phase 4 deliberate cuts):**
- Filters на доске (search / assignee / archived) — спека просила, в MVP пропустили.
- Drag-n-drop задач из бэклога в sprint (сейчас sprint membership через таблицу, но UI добавления через select). Можно сделать через vuedraggable group="tasks-and-sprint".
- Sprint detail view (внутри одного спринта — список его задач, burndown chart).
- Column rename / delete UI (сейчас только create + drag-reorder отсутствует).
- WIP-limit visual indicator на доске (badge есть, но без подсказки «как только превысишь — backend откажется двигать туда задачу с force=false»).
- Workspace edit / delete UI.
- Toast notifications (сейчас все ошибки через inline UAlert).

---

## Структура реального кода (после Phase 4)

```
scrumban_app/
├── app/                                  ← Nuxt 4 SPA frontend (ssr:false)
│   ├── app.config.ts                     ← Nuxt UI v4 theme (indigo/slate)
│   ├── app.vue                           ← <UApp><NuxtLayout><NuxtPage/></NuxtLayout></UApp>
│   ├── assets/css/main.css               ← Tailwind 4 @theme: Manrope/JetBrains Mono
│   ├── components/
│   │   ├── AppHeader.vue                 ← shell (без префикса)
│   │   ├── AppSidebar.vue                ← shell с WorkspaceSwitcher
│   │   ├── auth/{Login,Register}Form.vue ← <UForm :schema :state>
│   │   ├── workspace/                    ← Switcher, CreateModal, MemberRoleBadge, AddMemberModal
│   │   ├── board/                        ← BoardColumn, BoardSubnav, CreateModal, CreateColumnModal
│   │   ├── task/                         ← TaskCard, TaskDrawer, EventTimeline, CreateModal
│   │   ├── sprint/                       ← SprintCard, StateBadge, CreateModal
│   │   └── analytics/                    ← CfdChart, CycleTimeScatter, ThroughputChart, MonteCarloCard, WipRecommendationsCard
│   ├── composables/
│   │   ├── useApi.ts                     ← $fetch wrapper, 401 → pageRoutes.login
│   │   ├── useBoardSse.ts                ← useEventSource → invalidate tasks query
│   │   ├── api/                          ← useAuthApi, useWorkspacesApi, useBoardsApi, useMembersApi, useColumnsApi, useTasksApi, useTaskEventsApi, useSprintsApi, useSprintTasksApi, useAnalyticsApi
│   │   └── domain/                       ← useTaskMove (optimistic DnD)
│   ├── layouts/
│   │   ├── default.vue                   ← sidebar + header + main
│   │   └── auth.vue                      ← centered card (login/register pages)
│   ├── middleware/
│   │   └── auth.global.ts                ← suspense + redirect to /login
│   ├── pages/
│   │   ├── index.vue                     ← landing (public)
│   │   ├── login.vue, register.vue       ← auth layout
│   │   └── workspaces/
│   │       ├── index.vue                 ← список workspaces
│   │       └── [id]/
│   │           ├── index.vue             ← redirect to /boards
│   │           ├── members.vue           ← roster + RBAC
│   │           └── boards/
│   │               ├── index.vue         ← список досок
│   │               └── [boardId]/
│   │                   ├── index.vue     ← kanban
│   │                   ├── sprints.vue   ← state machine UI
│   │                   └── analytics.vue ← 5 ECharts
│   ├── plugins/
│   │   ├── vue-query.ts                  ← QueryClient (staleTime 30s, retry 1)
│   │   └── echarts.client.ts             ← tree-shaken ECharts
│   ├── routing/index.ts                  ← apiRoutes + pageRoutes
│   ├── stores/
│   │   ├── auth.store.ts                 ← computed wrapper над sessionQuery
│   │   ├── workspace.store.ts            ← currentId в useStorage
│   │   └── board.store.ts                ← openTaskId для drawer
│   └── utils/
│       ├── format.ts                     ← formatRelativeDate, formatPercentile
│       ├── humanize.ts                   ← Role/SprintState/TaskEventType ru-labels
│       ├── rbac.ts                       ← hasRole (mirror серверного requireMinRole)
│       └── slugify.ts                    ← обёртка slugify-lib
├── server/                               ← Nitro backend (без изменений с Phase 3)
│   ├── api/                              ← 44 endpoint'а
│   ├── services/                         ← бизнес-логика
│   ├── db/schema/                        ← 9 таблиц
│   └── utils/                            ← auth, db, errors, events, rbac
├── shared/types/                         ← cross-app + cross-server типы
│   ├── auth.ts                           ← #auth-utils augmentation + SessionUser/LoginInput/RegisterInput
│   ├── domain.ts                         ← cross-domain enums (Role, SprintState, TaskPriority, TaskEventType)
│   ├── workspace.ts                      ← Workspace, MemberView, inputs
│   ├── board.ts                          ← Board, inputs
│   ├── column.ts                         ← BoardColumn, ColumnRole, inputs
│   ├── task.ts                           ← Task, TaskEvent, inputs
│   ├── sprint.ts                         ← Sprint, inputs
│   └── analytics.ts                      ← 5 report types (discriminated unions для MC и WIP)
├── scripts/codesign-natives.sh           ← postinstall macOS Tahoe fix
├── drizzle/migrations/                   ← 7 SQL миграций
├── db/init/01_app_role.sql               ← двух-ролевой Postgres setup
├── docker-compose.dev.yml                ← Postgres 16 на :5433
├── tests/                                ← 12 файлов, 124 теста
└── docs/                                 ← полная документация + memory + UML
```

---

## Ключевые архитектурные решения для ревью

**Backend (Phases 1-3):**
1. **Two-role Postgres** (`scrumban` super для миграций, `scrumban_app` non-super для рантайма) — чтобы FORCE ROW LEVEL SECURITY реально применялся.
2. **NULLIF guard в RLS политиках** — `current_setting('app.workspace_id', true)` возвращает '' после `SET LOCAL`.
3. **withTenant() helper** — единственный путь к tenant-scoped queries; вне его RLS возвращает 0 строк.
4. **task_events append-only log** — фундамент для аналитики.
5. **State machine в moveTask** — closed_at и reopened_count синхронны с переходами через 'done' колонку.
6. **Reorder через парковку (PARKING_POSITION = 1_000_000)** — обходит unique constraint на (board_id, position).
7. **In-process event bus для SSE** — Phase 5 расширим LISTEN/NOTIFY когда появятся 2+ реплики.
8. **Min-sample thresholds в analytics** — percentiles null при <5 образцов; MC `{ok: false}` при <14 days history.

**Frontend (Phase 4):**
9. **vue-query как единственный server-state layer** — все API IO через `useQuery`/`useMutation`; Pinia только для UI state (currentId, openTaskId).
10. **Optimistic DnD через `qc.setQueryData` + invalidate** — мгновенный visual feedback, refetch consistency.
11. **SSE без payload-merge** — на любой board-event просто invalidate `['tasks', wsId, boardId]`; дешевле и надёжнее, чем patch'ить cache из payload.
12. **`<UForm :schema :state>` Nuxt UI native** — zod схема прямо в template, FormValidationException → per-field errors в `<UFormField>` без adapter'ов.
13. **Routing manifest** — все 30 apiRoutes + 10 pageRoutes в `app/routing/index.ts`; literal `/api/` или `/login` вне = bug.
14. **Component naming via folder prefix** — Nuxt префиксует `components/{domain}/X.vue` → `<DomainX>`; shell-компоненты в `components/` root без префикса.
15. **Discriminated unions для unreliable analytics** — MC и WIP возвращают `{ok: true, ...}` или `{ok: false, reason}`; UI рендерит ветку напрямую, не через try/catch.

---

## Контекст user

- **Даня** — магистрант ВолГУ, делает scrumban как дипломный проект, solo.
- **Frontend-сильный** (Nuxt/Vue/TS); backend написал Claude. **Phase 4 frontend сделан совместно** — Claude писал код в чате, user смотрел в IDE (см. memory: `feedback_ide_review.md`).
- **Хочет понимать**, что Claude делает в backend — через краткие комментарии и объяснения.
- **Делает senior-grade критику архитектуры** — ML был заменён на статистику не случайно.
- **Имеет PlantUML plugin в IDE** — SVG в `learning/` не генерируем.
- **Обращение на «ты»**, русский язык, **коммиты на английском, без `Co-Authored-By: Claude`** (см. memory: `feedback_no_coauthor_trailer.md`).

---

## Регулярные обновления

**Этот файл должен обновляться после каждого значимого куска работы.** Минимум:
- Пополнить список «Что сделано».
- Обновить «Что дальше».
- Обновить дату в заголовке.