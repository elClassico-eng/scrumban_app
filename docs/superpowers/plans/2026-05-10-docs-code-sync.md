# Docs ↔ Code Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Привести всю документацию (12 numbered docs + master spec + 7 UML-наборов + UML README) в честное соответствие реализованному коду. Всё, что код сознательно не реализовал, — пометить как Target Architecture с явными триггерами эволюции. Зачистить obsolete артефакты в `docs/archive/`. Сохранить все `learning/` подпапки UML без изменений.

**Approach:**
- **Current ≠ Target.** В каждом затронутом документе явно разделяем реализованное (Current) и обоснованно отложенное (Target) с триггером эволюции.
- **Audit как единственный спек.** `docs/audit-2026-05-10-issues.md` — список всех расхождений; план переводит его в правки.
- **Решения user'а зафиксированы:**
  - Уровень 3 (events vs task_events, projects, MV, pg-boss, LISTEN/NOTIFY, sessions) → Target в docs с триггерами.
  - Obsolete spec/plan → `docs/archive/` с migration header.
  - UML основная диаграмма = Current; для **component** и **ER** дополнительно создать `target/*.puml`. Для остальных — только Current. Все `learning/` оставить нетронутыми.
- **Гранулярные коммиты.** По одному коммиту на логическую единицу (док, диаграмма, группа правок).
- **Никакого TDD.** Это документация. Верификация = re-read + grep на устаревшие термины (`Go`, `Nuxt 3`, `pg-boss` без Target-маркера, `4 роли`, `argon2id` в коде, etc.).

**Tech Stack (для контекста, ничего нового не вводим):** Markdown, PlantUML, bash (`mv`, `mkdir`, `grep`).

**Объём:** ~20 задач. Реалистичный срок 2–3 фокусных дня.

---

## Карта затронутых файлов

### Создаются
- `docs/archive/` — папка для obsolete artifacts.
- `docs/archive/2026-04-18-scrumban-platform-design.md` — перенесённый Go-spec.
- `docs/archive/2026-04-23-phase0-week1-nitro-starter.md` — перенесённый Phase 0 plan.
- `docs/archive/README.md` — пояснение, что лежит в archive и почему.
- `docs/uml/03-er/target/database.puml` — target ER-диаграмма (полный набор 20 entities).
- `docs/uml/04-component/target/components.puml` — target component-диаграмма (с pg-boss, Worker, LISTEN/NOTIFY).

### Редактируются (numbered docs)
- `docs/01-vision-and-goals.md` — quick scan, fix Go/role count.
- `docs/02-target-audience.md` — quick scan.
- `docs/03-competitive-analysis.md` — quick scan.
- `docs/04-economic-rationale.md` — quick scan.
- `docs/05-mvp-scope-and-roadmap.md` — переписать Phase 1-3 под реальность; Phase 4+ — что осталось.
- `docs/06-system-architecture.md` — ASCII-diagram + текст: pg-boss/LISTEN/NOTIFY/sticky sessions → Target.
- `docs/07-domain-model.md` — Current раздел = 9 таблиц; Target раздел = 11 entities + MV.
- `docs/08-backend-design.md` — реальная структура папок (`server/utils/`, `server/services/`); middleware → Target cleanup.
- `docs/09-frontend-design.md` — Nuxt 3 → 4; BFF к Go убрать; `frontend/` → monorepo.
- `docs/10-analytics-design.md` — убрать Go-пакеты; обновить пороги; cache/jobs → Target.
- `docs/11-non-functional.md` — RBAC matrix 4 → 5 ролей (+scrum_master); `withTenant` пример с `set_config(... , true)`; rate limit/observability/CSP/HSTS → Target с триггерами.
- `docs/12-deployment.md` — quick scan, sync со стеком (Caddy, docker-compose).

### Редактируются (specs)
- `docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md` — структура папок: пометить, что реализовано (`server/api/`, `server/services/`, `server/db/`, `server/utils/`) vs Target (`server/middleware/`, `server/jobs/`, `openapi/`, `shared/types/api.d.ts`).

### Редактируются (UML)
- `docs/uml/03-er/database.puml` — переписать под 9 таблиц.
- `docs/uml/03-er/database.md` (если есть) — sync.
- `docs/uml/02-class/domain-classes.puml` — переписать под 9 entities; enum'ы (Role 5, ColumnRole 5 с archived, TaskPriority low/medium/high).
- `docs/uml/02-class/domain-classes.md` — sync.
- `docs/uml/04-component/components.puml` — переписать под Current (без pg-boss/Aggregator/Worker/LISTEN/Email Sender).
- `docs/uml/04-component/components.md` — sync.
- `docs/uml/06-sequence/login.puml` — sessions table → подписанный cookie через nuxt-auth-utils; scrypt; `/api/auth/login`.
- `docs/uml/06-sequence/create-task-sse.puml` — реальные пути; `task_events` со спец. колонками; убрать pg-boss.
- `docs/uml/06-sequence/monte-carlo.puml` — реальный path; убрать forecast cache; пороги 14d/0closed; параметры из query string.
- `docs/uml/06-sequence/*.md` — sync если есть.
- `docs/uml/01-use-case/use-case.puml` — пометить нереализованные UC стереотипом `<<Future>>`; убрать external actors (SMTP, Bot, Git Platform) или пометить Future.
- `docs/uml/01-use-case/use-case.md` — sync.
- `docs/uml/01-use-case/per-role/*.puml` — те же стереотипы.
- `docs/uml/07-state/task-lifecycle.puml` — `task_moved_column` → `task_moved`; убрать `set deleted_at` для archived.
- `docs/uml/07-state/sprint-lifecycle.puml` — пометить sprint events / SSE как Target.
- `docs/uml/05-deployment/README.md` (создать) — заглушка с пометкой "TBD при работе над deploy (Phase 4)".
- `docs/uml/README.md` — убрать упоминание deployment как существующей; убрать Go из Component строки; убрать ссылку на старый Go-spec; добавить ссылку на pivot.

### Редактируются (код-комментарии)
- `server/db/schema/users.ts` — `argon2id` → `scrypt`.
- `server/api/auth/register.post.ts` — `argon2id` → `scrypt`.
- `server/utils/db.ts` — `SET LOCAL` → `set_config(..., true)` или объяснение эквивалентности.

### Не трогаем
- Все `docs/uml/*/learning/` — учебные диаграммы оставляем нетронутыми (решение user).
- `docs/uml/theory.md` — справочник по UML, не зависит от кода.
- `docs/memory/*` — синхронизированный снапшот auto-memory; не входит в скоуп.
- `docs/audit-2026-05-10-issues.md` — это input plan'а, не output.

### Финальные обновления
- `COMPACT.md` — секция «Что сделано» + «Что дальше».

---

## Принцип Target-секций (применяется во всех документах)

Везде, где документ описывает функциональность/инфраструктуру, не реализованную в коде, использовать единый формат:

```markdown
### Target: <название>

> **Status:** не реализовано в Phase 1-3 MVP.
> **Триггер ввода:** <конкретное условие, при котором имеет смысл вводить — например: "p95 latency `/api/.../analytics/*` > 500 мс при ≥ 100 закрытых задач/мес"; "появление 2-й реплики Nitro"; "первый Enterprise-клиент"; "≥ 3 одновременных команд по 30+ человек"; etc>

<описание решения, как было задумано>
```

Триггер должен быть **измеримым и привязан к нагрузке/бизнесу**, а не "потом сделаем". На защите это позиционируется как обоснованная YAGNI-эволюция.

---

## Task 0: Setup — `docs/archive/` и перемещение obsolete

**Files:**
- Create: `docs/archive/`, `docs/archive/README.md`
- Move: `docs/superpowers/specs/2026-04-18-scrumban-platform-design.md` → `docs/archive/2026-04-18-scrumban-platform-design.md`
- Move: `docs/superpowers/plans/2026-04-23-phase0-week1-nitro-starter.md` → `docs/archive/2026-04-23-phase0-week1-nitro-starter.md`

- [ ] **Step 1: Создать папку и README**

```bash
mkdir -p "docs/archive"
```

Создать `docs/archive/README.md` с содержимым:

```markdown
# Архив документов

Здесь лежат документы, которые **больше не отражают текущий план реализации**, но сохраняются как часть истории архитектурных решений (нужно для главы «Эволюция архитектуры» в магистерской работе).

Каждый файл получает migration header с указанием:
- даты изменения курса;
- что и почему заменило этот документ;
- ссылки на актуальный документ.

## Содержимое

| Файл | Заменён на | Дата pivot'а |
|------|------------|---------------|
| `2026-04-18-scrumban-platform-design.md` | `docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md` | 2026-04-23 |
| `2026-04-23-phase0-week1-nitro-starter.md` | (обнулён, Phase 0 пропущен — реализация начата сразу с Phase 1) | 2026-04-26 |
```

- [ ] **Step 2: Переместить Go-spec и добавить migration header**

```bash
git mv "docs/superpowers/specs/2026-04-18-scrumban-platform-design.md" "docs/archive/2026-04-18-scrumban-platform-design.md"
```

Открыть `docs/archive/2026-04-18-scrumban-platform-design.md` и **добавить в самый верх (до текущего `# `-заголовка)** блок:

```markdown
> ## ⚠️ OBSOLETE — оставлен как референс архитектурной эволюции
>
> **Статус:** заменён pivot'ом 2026-04-23.
> **Актуальный master spec:** [`docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`](../superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md)
> **Причина смены курса:** solo full-stack разработчик с TS/Vue фоном и нулевым опытом Go не мог быть автором Go-backend, только пассивным наблюдателем. На защите это вскрылось бы первым же вопросом. Принято решение: Nuxt monorepo (Nitro backend на TypeScript) — единый стек, end-to-end типизация, понятная авторская архитектура.
> **Зачем сохранён:** материал для главы «Эволюция архитектуры» в магистерской работе. Документ показывает рассмотренный и обоснованно отвергнутый альтернативный путь (Go-backend split-stack).

---

```

- [ ] **Step 3: Переместить Phase 0 plan и добавить header**

```bash
git mv "docs/superpowers/plans/2026-04-23-phase0-week1-nitro-starter.md" "docs/archive/2026-04-23-phase0-week1-nitro-starter.md"
```

Добавить в верх файла:

```markdown
> ## ⚠️ OBSOLETE — Phase 0 пропущен
>
> **Статус:** план не выполнялся, реализация началась сразу с Phase 1.
> **Причина:** на момент 2026-04-26 user принял решение пропустить отдельный pet-project Phase 0 и начать сразу с Phase 1 (RLS-foundation для Scrumban).
> **Зачем сохранён:** показывает рассмотренный learning-путь (Phase 0 как pet-project для освоения TS-backend), отказ от которого — обоснованное решение solo-разработчика с уверенным TS-фоном.

---

```

- [ ] **Step 4: Поиск ссылок на перемещённые файлы и их обновление**

```bash
grep -rn "2026-04-18-scrumban-platform-design" docs/ --include="*.md"
grep -rn "2026-04-23-phase0-week1-nitro-starter" docs/ --include="*.md"
```

Каждую найденную ссылку **в файлах вне `docs/archive/`** заменить на `docs/archive/<имя>.md` (либо удалить, если ссылка стала бессмысленной — например, в `docs/uml/README.md` ссылка на Go-spec как master spec; её надо заменить ссылкой на pivot).

- [ ] **Step 5: Verify and commit**

```bash
ls -la docs/archive/
ls -la docs/superpowers/specs/
ls -la docs/superpowers/plans/
```

Ожидаемо: в `docs/archive/` 3 файла (README + 2 архивных); в `specs/` остался только `2026-04-23-nuxt-monorepo-pivot.md`; в `plans/` остался только `2026-04-23-pivot-docs-update.md`.

```bash
git add docs/archive/ docs/superpowers/specs/ docs/superpowers/plans/
git status
git commit -m "docs(archive): move obsolete Go-spec and Phase 0 plan to archive

Создаёт docs/archive/ с migration header'ами:
- 2026-04-18-scrumban-platform-design.md (Go-spec, заменён pivot'ом)
- 2026-04-23-phase0-week1-nitro-starter.md (Phase 0 пропущен)

История решений сохранена для главы 'Эволюция архитектуры' в магистерской работе."
```

---

## Task 1: Fix code comments (3 файла)

**Files:**
- Modify: `server/db/schema/users.ts`
- Modify: `server/api/auth/register.post.ts`
- Modify: `server/utils/db.ts`

- [ ] **Step 1: `users.ts`** — найти комментарий со словом `argon2id` и заменить на отражение реальной схемы

Ожидаемая правка (точную формулировку проверить чтением файла, шаблон такой):

Было: `Password is stored as an argon2id hash (computed by nuxt-auth-utils)`.
Стало: `Password is stored as a scrypt hash via nuxt-auth-utils hashPassword(); scrypt is built into Node and is the library default. Argon2id is supported but requires @node-rs/argon2 (not installed).`

- [ ] **Step 2: `register.post.ts`** — найти комментарий `argon2id` и заменить

Было: `hashes the password via nuxt-auth-utils (argon2id)`.
Стало: `hashes the password via nuxt-auth-utils hashPassword() — scrypt (Node-native, library default)`.

- [ ] **Step 3: `db.ts`** — комментарий про `SET LOCAL`

Найти строку с `SET LOCAL`. Заменить на формулировку, поясняющую, что используется `set_config('app.workspace_id', $1, true)` (последний параметр `is_local=true` — функциональный эквивалент `SET LOCAL`, но с поддержкой prepared-statement plаceholder'ов, которых `SET LOCAL` не принимает).

Шаблон комментария:
```ts
// Use set_config(..., is_local=true) instead of SET LOCAL: functionally equivalent
// (transaction-scoped) but accepts $1 placeholders that SET LOCAL syntactically rejects.
```

- [ ] **Step 4: Verify by grep**

```bash
grep -rn "argon2id" server/ --include="*.ts"
grep -rn "SET LOCAL" server/ --include="*.ts"
```

Ожидаемо: нет неправильных упоминаний `argon2id` (как описывающих что используется), нет описаний `SET LOCAL` как нашей реализации.

- [ ] **Step 5: Run tests**

```bash
bun test
```

Ожидаемо: 124 теста зелёные. Комментарии не должны ломать ничего — но запускаем, чтобы убедиться, что Edit не задел код случайно.

- [ ] **Step 6: Commit**

```bash
git add server/db/schema/users.ts server/api/auth/register.post.ts server/utils/db.ts
git commit -m "docs(code): fix stale comments — scrypt not argon2id; set_config not SET LOCAL

nuxt-auth-utils использует scrypt по умолчанию (argon2id требует @node-rs/argon2,
не установлен). withTenant использует set_config(..., is_local=true) — функционально
эквивалентно SET LOCAL, но принимает placeholder'ы."
```

---

## Task 2: Sync `docs/07-domain-model.md`

**Files:**
- Modify: `docs/07-domain-model.md`

**Цель:** разделить документ на Current (9 таблиц) и Target (11 entities + 3 MV). Внутренние противоречия по полям убрать.

- [ ] **Step 1: Прочитать файл целиком**

```bash
wc -l docs/07-domain-model.md  # ожидаемо ~280-350 строк (12kb)
```

Открыть в Read и составить mental map: какие entities описаны, какие поля, какие связи.

- [ ] **Step 2: Сверить с реальной схемой кода**

```bash
ls server/db/schema/
cat server/db/schema/*.ts | grep -E "^export const|pgTable\(" | head -50
```

Получить полный список реальных таблиц + их полей.

- [ ] **Step 3: Структурировать документ как Current + Target**

Вверху документа (после `# 07 — Domain Model`) добавить навигацию:

```markdown
## Структура документа

- [Current (Phase 1-3 MVP)](#current-phase-1-3-mvp) — 9 реализованных таблиц.
- [Target (Phase 4+)](#target-phase-4) — 11 entities и 3 materialized view, обоснованно отложенные с триггерами эволюции.

---
```

- [ ] **Step 4: Заполнить Current раздел**

Описать **только** реализованные таблицы со ссылками на файлы кода:

```markdown
## Current (Phase 1-3 MVP)

Все таблицы описаны в `server/db/schema/*.ts`. RLS политики — в миграции `drizzle/migrations/0001_*`.

### `users` ([`server/db/schema/users.ts`](../server/db/schema/users.ts))
- `id uuid PK` (defaultRandom — UUID v4)
- `email text UNIQUE NOT NULL`
- `password_hash text NOT NULL` (scrypt через nuxt-auth-utils)
- `created_at`, `updated_at timestamptz`

### `workspaces` ([`server/db/schema/workspaces.ts`](../server/db/schema/workspaces.ts))
- `id uuid PK`
- `name text NOT NULL`
- `slug text UNIQUE NOT NULL` — global unique (риск коллизий — см. backlog)
- `created_at`, `updated_at`

> **Owner определяется** через `workspace_members.role = 'owner'`, отдельной FK на users нет (упрощает RBAC).

### `workspace_members` (...)
- 5 ролей: `viewer`, `member`, `scrum_master`, `admin`, `owner`
- ...

[... аналогично для всех 9 таблиц ...]

### Связи (Current)

```
workspaces 1—N workspace_members N—1 users
workspaces 1—N boards 1—N board_columns
boards 1—N tasks
tasks 1—N task_events
boards 1—N sprints N—M tasks (через sprint_tasks)
```

ER-диаграмма Current: [`docs/uml/03-er/database.puml`](uml/03-er/database.puml).
```

Полные тексты полей по каждой таблице писать на основе чтения `server/db/schema/*.ts`.

- [ ] **Step 5: Заполнить Target раздел**

```markdown
## Target (Phase 4+)

Сущности, обоснованно отложенные. Каждая описана с триггером ввода.

### `projects` (контейнер досок и спринтов)
> **Status:** не реализовано. **Триггер:** workspace начинает использовать ≥ 3 досок одновременно с разным набором задач, и user'ы запутываются между ними. Сегодня workspace → board напрямую достаточно.
>
> Поля при вводе: `id`, `workspace_id` FK, `name`, `key` (например `SCB`), `archived_at`. Tasks получат `project_id` + `short_id` (например, `SCB-123`).

### `task_comments`
> **Status:** не реализовано. **Триггер:** появляется первая команда, которая использует Scrumban не как «личный список дел», а как orchestration tool с asynchronous discussion (≥ 5 человек, регулярные обсуждения внутри задачи).
>
> ...

[... аналогично для всех 11 entities + 3 MV ...]

### `events` (универсальная append-only)
> **Status:** реализован специализированный `task_events` (см. Current). **Триггер перехода к универсальной:** появление ≥ 3 типов entities, для которых нужен event-log (sprint_events, comment_events, attachment_events). Сейчас единственный event-source — task'и; специализация даёт типизацию `from_column_id`/`to_column_id` без `payload jsonb`-pаrsing'а.

### `sessions` (server-side session storage)
> **Status:** не реализовано. Используется подписанный HTTP-only cookie через nuxt-auth-utils (stateless). **Триггер ввода server-side sessions:** первая необходимость *глобального revoke* — пользователь утерял устройство, админ должен инвалидировать все его сессии. Сегодня cookie ttl + `clearUserSession` достаточно.

### Materialized views
- **`mv_cfd_last_90d`** — refresh hourly. **Триггер:** p95 latency `/api/.../analytics/cfd` > 500 мс при ≥ 100 закрытых задач/мес.
- **`mv_throughput_weekly`** — refresh daily. **Триггер:** Monte Carlo-запрос > 1.5 с (сейчас 50–150 мс на 1000 итераций).
- **`mv_cycle_time_percentiles`** — refresh hourly. **Триггер:** p95 latency `/api/.../analytics/cycle-time` > 500 мс.
```

- [ ] **Step 6: Удалить или переписать секции, противоречащие реальности**

Найти и убрать (или переместить в Target) описания:
- Старого `tasks` со `project_id`, `short_id`, `type`, `story_points`, `estimate_hours`, `reporter_id` — переместить в Target/Future.
- `priority: low/normal/high/urgent` — заменить на `low/medium/high` (Current).
- 4-ролевую модель — заменить на 5-ролевую (Current — со ссылкой на `roles-guide.md`).

- [ ] **Step 7: Verify**

```bash
grep -nE "argon2id|Nuxt 3|Go-пакет|story_points|reporter_id|short_id" docs/07-domain-model.md
# Ожидаемо: только в Target секциях (если упоминается, то с пометкой Target).
```

- [ ] **Step 8: Commit**

```bash
git add docs/07-domain-model.md
git commit -m "docs(07): split into Current (9 tables) + Target (11 entities + 3 MV)

Current отражает реальную схему server/db/schema/. Target описывает 11 entities
(projects, task_comments, attachments, tags, invitations, sessions, feature_flags,
flow_daily, cycle_time_samples, sprint_stats, audit_log) + 3 materialized view
с явными триггерами ввода (нагрузка/бизнес-условие). 4 роли → 5 ролей.
priority: low/medium/high (соответствие коду)."
```

---

## Task 3: Sync `docs/06-system-architecture.md`

**Files:**
- Modify: `docs/06-system-architecture.md`

**Цель:** ASCII-диаграмма и текст архитектуры — Current отражает реальный Nitro-процесс без pg-boss/LISTEN-NOTIFY/sticky sessions; Target описывает добавления с триггерами.

- [ ] **Step 1: Прочитать файл целиком**

- [ ] **Step 2: Заменить главную ASCII-диаграмму**

Найти диаграмму компонентов (строки ~9–41 в текущей версии) и заменить на **Current-вариант** без `pg-boss workers`, `LISTEN/NOTIFY`, без `sticky sessions` в Caddy:

```
┌─────────────────── Browser (Nuxt 4 SPA) ──────────────────┐
│   Vue 3 • Pinia • ECharts • SSE-клиент • TypeScript       │
└────────────────────────┬──────────────────────────────────┘
                         │ HTTPS
┌────────────────────────▼──────────────────────────────────┐
│       Reverse-proxy + TLS (планируется Caddy в Phase 4)   │
└────────────────────────┬──────────────────────────────────┘
                         │
                ┌────────▼──────────────────────┐
                │    Nitro Server (1 реплика)   │
                │  - HTTP API (H3 router)        │
                │  - in-handler auth + tenant    │
                │  - domain services             │
                │  - analytics engine (live)     │
                │  - in-process EventEmitter     │
                │  - SSE hub                     │
                │  - SPA static (Nuxt build)     │
                └──┬─────────────────────────────┘
                   │
        ┌──────────▼──────────┐
        │   PostgreSQL 16      │
        │ - tenant data + RLS  │
        │ - task_events log    │
        └──────────────────────┘
```

Сразу после диаграммы — отдельный блок Target с пояснением, какие компоненты добавятся:

```markdown
### Target architecture (Phase 4+)

Добавления к Current с триггерами:

```
┌── Caddy ────┐
│ TLS         │  ← Триггер ввода: первый продакшн-деплой
│ sticky cks  │  ← Триггер sticky sessions: появление 2-й Nitro-реплики
└─────────────┘

Nitro Server (N реплик):
  + pg-boss workers          ← Триггер: первый async job (email send / webhook dispatch / aggregate recompute / MC refresh)
  + LISTEN/NOTIFY bridge     ← Триггер: появление 2-й реплики (cross-node SSE fan-out)
  + Aggregator service       ← Триггер: p95 analytics latency > 500ms

PostgreSQL:
  + flow_daily aggregates    ← Триггер: вместе с Aggregator
  + materialized views       ← Триггер: p95 analytics > 500ms
  + pg-boss job queue        ← Триггер: вместе с pg-boss workers
  + LISTEN/NOTIFY channel    ← Триггер: вместе с bridge

Object Storage (S3-compat / MinIO):
  + attachments              ← Триггер: реализация `task_attachments` entity
  + backups                  ← Триггер: первый продакшн-клиент с реальными данными
```
```

- [ ] **Step 3: Sync текст архитектурных решений**

Найти раздел «Reverse-proxy (Caddy) как единая точка входа» (строки ~52–56 в текущей версии). Sticky sessions — Target. Заменить:

Было: `- Sticky sessions для SSE (критично при scale-out).`
Стало: `- Sticky sessions для SSE — Target (включается при появлении 2-й реплики Nitro).`

Найти раздел про PostgreSQL/pg-boss/LISTEN-NOTIFY (строки ~58+). Перенести описание pg-boss + LISTEN/NOTIFY в Target-секцию с триггерами.

- [ ] **Step 4: Добавить отдельный раздел `## Target Architecture` в конец**

Если ещё не добавлен — список Target-компонентов с триггерами (см. Step 2 ASCII).

- [ ] **Step 5: Verify**

```bash
grep -nE "pg-boss|LISTEN/NOTIFY|sticky session" docs/06-system-architecture.md
# Ожидаемо: только в Target-блоках или с явной пометкой Target/Phase 4.
```

- [ ] **Step 6: Commit**

```bash
git add docs/06-system-architecture.md
git commit -m "docs(06): архитектура — отделить Current (1 реплика, in-process) от Target (pg-boss/LISTEN/NOTIFY/sticky sessions)

Current отражает реальный Nitro-процесс без фоновых джобов, без cross-node fan-out.
Target — добавления с триггерами (2-я реплика, первый async job, p95 analytics > 500ms)."
```

---

## Task 4: Sync `docs/11-non-functional.md`

**Files:**
- Modify: `docs/11-non-functional.md`

**Цель:** RBAC matrix 4 → 5 ролей; `withTenant` пример с `set_config`; rate limit/observability/CSP/HSTS/audit log → Target с триггерами; убрать `extractWorkspaceFromPath` middleware.

- [ ] **Step 1: Прочитать файл целиком**

- [ ] **Step 2: RBAC секция — 5 ролей**

Найти раздел `### Роли (MVP)` (примерно строки 27–32). Заменить:

```markdown
### Роли (MVP)
- **Owner** — создатель workspace'а. Все права, включая удаление workspace.
- **Admin** — управляет членами, проектами, настройками. Не может удалить workspace.
- **Scrum Master** — управляет спринтами и аналитикой команды; не управляет членством.
- **Member** — работает с задачами: создаёт, редактирует, перемещает.
- **Viewer** — только чтение.

Иерархия: `viewer < member < scrum_master < admin < owner`.

Полное описание см. [`docs/roles-guide.md`](roles-guide.md).
```

Найти таблицу разрешений (строки ~33–43). Добавить колонку `Scrum Master`:

```markdown
| Действие | Owner | Admin | Scrum Master | Member | Viewer |
|----------|-------|-------|--------------|--------|--------|
| Управлять workspace (settings, plan) | ✓ | − | − | − | − |
| Приглашать / удалять членов | ✓ | ✓ | − | − | − |
| Управлять ролями членов (≤ свою) | ✓ | ✓ | − | − | − |
| Создавать доски, колонки | ✓ | ✓ | ✓ | ✓ | − |
| Конфигурировать WIP-лимиты | ✓ | ✓ | ✓ | − | − |
| Создавать / редактировать задачи | ✓ | ✓ | ✓ | ✓ | − |
| Управлять спринтами (start/close) | ✓ | ✓ | ✓ | − | − |
| Просматривать аналитику | ✓ | ✓ | ✓ | ✓ | ✓ |
| Удалять workspace | ✓ | − | − | − | − |
```

(Точные права scrum_master сверить с `roles-guide.md` перед коммитом.)

- [ ] **Step 3: Реализация RBAC — убрать middleware**

Найти раздел `### Реализация` (примерно строки 49–52). Заменить:

```markdown
### Реализация (Current)

- Helper'ы `roleAtLeast(actorRole, requiredRole)` и `strictlyOutranks(actorRole, targetRole)` — единственный источник правды (`server/services/rbac.service.ts`).
- Each handler в `server/api/**` сам вызывает RBAC-helper в начале (паттерн guard clause). Отдельной middleware-папки нет.
- «Last owner» guard в `assertNotLastOwner` запрещает понизить или удалить последнего owner'а workspace.
- Frontend условно показывает кнопки на основе role; **RBAC всегда проверяется на сервере**, frontend только скрывает UI.

### Target: middleware extraction (Phase 4 cleanup)

> **Триггер:** ≥ 30 endpoint'ов с одинаковым RBAC-guard'ом + желание автоматически генерировать в OpenAPI описание required role.

Вынести RBAC в `server/middleware/rbac.ts` с helper'ом `requireRole(event, 'admin')` или `requirePermission(event, 'task.create')`.
```

- [ ] **Step 4: `withTenant` пример**

Найти блок `withTenant` (примерно строки 90–97). Заменить пример на реальный код:

```typescript
export async function withTenant<T>(workspaceId: string, fn: (tx: Transaction) => Promise<T>): Promise<T> {
  return db.transaction(async tx => {
    // set_config('app.workspace_id', $1, true) — функциональный эквивалент SET LOCAL
    // (transaction-scoped), но принимает $1 placeholder. SET LOCAL placeholder не принимает.
    await tx.execute(sql`SELECT set_config('app.workspace_id', ${workspaceId}, true)`)
    return fn(tx)
  })
}
```

- [ ] **Step 5: Tenant middleware — пометить как Target**

Найти блок `Tenant middleware (Nitro)` с примером `extractWorkspaceFromPath`. Заменить:

```markdown
### Current implementation: in-handler tenant scoping

Каждый handler в `server/api/workspaces/[id]/**` извлекает `workspaceId` через `getValidatedRouterParams(event, ...)` сам и вызывает `withTenant(workspaceId, async tx => ...)` для всех DB-операций. Middleware-слоя нет.

### Target: tenant middleware

> **Триггер:** ≥ 30 endpoint'ов в `/workspaces/[id]/...` с одинаковой extraction-логикой; желание убрать boilerplate из каждого handler'а.

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
```

- [ ] **Step 6: Auth → раздел про rate limit / 2FA / audit log → Target**

Найти раздел `## Аутентификация (authN)` → `### MVP` (строки ~3–13). Если в нём указано `rate limit на /api/auth/login (5 попыток / 5 мин на email)` как реализованное — переместить в Target:

```markdown
### Target: brute-force protection

> **Status:** не реализовано. **Триггер:** первая публичная регистрация / появление первого реального клиента (до этого — internal-only deploy).
>
> Rate limit на `/api/auth/login` — 5 попыток / 5 мин на email. После превышения — CAPTCHA или блокировка на 15 мин.
> Восстановление пароля — email-ссылка, 1 час TTL, одноразовая.
> Audit log auth-событий — отдельная таблица `auth_audit_log` (retention 90 дней).
```

- [ ] **Step 7: Observability — пометить pino не подключённым**

Найти `## Observability` (примерно строки 115+). Заменить:

```markdown
## Observability

### Current

Минимальный — `console.log` в dev для диагностики; в prod пока ничего не настроено.

### Target: structured logging (Phase 4)

> **Триггер:** первый деплой на prod-VM (нужно собирать логи в чём-то агрегируемом).
>
> - `pino` (Node.js standard для structured JSON) — **уже в `package.json`, осталось подключить в `server/utils/logger.ts` и инжектить в каждый handler через `event.context.logger`**.
> - Формат JSON в prod, `pino-pretty` в dev.
> - Обязательные поля: `time`, `level`, `msg`, `requestId`, `userId` (если есть), `workspaceId` (если есть).
> - `requestId` middleware: генерирует UUID v4, выставляет в `event.context.requestId` и в response header `X-Request-ID`.

### Target: метрики и трейсинг (Phase 5)

> **Триггер:** появление SLA, или ≥ 2 реплик, или жалобы на «медленно».
>
> - Prometheus endpoint `/api/metrics` через `prom-client`.
> - Sentry для error tracking.
> - OpenTelemetry traces (опционально).
```

- [ ] **Step 8: Backups / CI/CD / CSP/HSTS → Target**

Найти соответствующие разделы и пометить с триггерами:

```markdown
### Target: backups

> **Триггер:** первый деплой с реальными клиентскими данными.
>
> - Ежесуточный `pg_dump` → Object Storage (S3-compat).
> - WAL-archiving — отдельный триггер: появление SLA на RPO < 24h.
> - Restore-test автоматизирован — отдельный триггер: данные становятся business-critical.

### Target: CI/CD

> **Триггер:** первый коллаборатор / момент, когда «пушнул не в ту ветку» уже больно.
>
> - GitHub Actions / GitFlic CI.
> - Pipeline: typecheck + vitest + build на каждый push в main; preview-deploy на PR.

### Target: HTTP security headers

> **Триггер:** первый продакшн-деплой за публичным URL.
>
> CSP, HSTS, X-Frame-Options, Referrer-Policy — конфигурируется в Caddyfile.
```

- [ ] **Step 9: Verify**

```bash
grep -nE "argon2id" docs/11-non-functional.md
# Ожидаемо: только в строке про "опционально переключаемо на argon2id" (правильно).

grep -nE "extractWorkspaceFromPath" docs/11-non-functional.md
# Ожидаемо: только в Target-блоке.

grep -nE "SET LOCAL" docs/11-non-functional.md
# Ожидаемо: только в комментарии про эквивалентность с set_config (или вообще нет).

grep -cE "scrum_master|Scrum Master" docs/11-non-functional.md
# Ожидаемо: ≥ 2 (упоминается в иерархии и в матрице).
```

- [ ] **Step 10: Commit**

```bash
git add docs/11-non-functional.md
git commit -m "docs(11): NFR — RBAC 5 ролей, Target секции для unimplemented (rate limit/observability/CSP/backups/CI)

- RBAC matrix: добавлен Scrum Master (5 ролей вместо 4).
- withTenant: SET LOCAL → set_config(... , true) — соответствует коду.
- Tenant middleware: помечен как Target; реальность — in-handler extraction.
- Auth: rate limit / password recovery / audit log — Target с триггерами.
- Observability: pino как Target (уже в package.json, не подключён).
- Backups, CI/CD, CSP/HSTS — Target с триггерами на продакшн-деплой."
```

---

## Task 5: Sync `docs/08-backend-design.md`

**Files:**
- Modify: `docs/08-backend-design.md`

**Цель:** реальная структура `server/`; убрать `server/middleware/`, `server/sse/`, `server/events/`, `server/analytics/`, `server/ff/` из Current; пометить codegen (`shared/types/api.d.ts`, `openapi/scrumban.yaml`) как Target.

- [ ] **Step 1: Прочитать файл и реальное дерево `server/`**

```bash
ls server/
ls server/api/
ls server/services/
ls server/utils/
ls server/db/schema/
```

Зафиксировать реальную структуру.

- [ ] **Step 2: Найти и заменить блок «структура папок»**

Заменить любые упоминания `server/middleware/`, `server/sse/`, `server/events/`, `server/analytics/`, `server/ff/` как Current — на реальный список:

```markdown
### Структура `server/` (Current)

```
server/
├── api/                    # H3 file-routing handlers
│   ├── auth/               # login, register, logout, session
│   ├── workspaces/
│   │   └── [id]/
│   │       ├── boards/...
│   │       └── members/...
│   └── ...
├── services/               # бизнес-логика, чистые TS-функции
│   ├── tasks.service.ts
│   ├── sprints.service.ts
│   ├── analytics.service.ts
│   ├── workspace-members.service.ts
│   ├── rbac.service.ts
│   └── ...
├── db/
│   └── schema/             # Drizzle table definitions
└── utils/
    ├── db.ts               # useDB() singleton + withTenant() helper
    ├── errors.ts           # Domain errors + toHttpError mapper
    ├── event-bus.ts        # in-process EventEmitter
    └── ...
```

Папок `middleware/`, `sse/`, `events/`, `analytics/`, `ff/`, `jobs/` **нет**. В-handler RBAC + tenant scoping; SSE и event-bus — в `utils/`; analytics — в `services/`.
```

- [ ] **Step 3: Добавить Target-секцию для будущей структуры**

```markdown
### Target structure (Phase 4 cleanup)

> **Триггер:** ≥ 30 одинаковых auth+tenant guard'ов в handler'ах; первая необходимость в фоновых джобах (email/webhook).

```
server/
├── api/...
├── services/...
├── middleware/             # auth, rbac, tenant
├── jobs/                   # pg-boss workers
├── analytics/              # выделение из services/ при разрастании
├── ff/                     # feature flags
└── utils/...
```
```

- [ ] **Step 4: Codegen — Target**

Найти упоминание `shared/types/api.d.ts` или `openapi/scrumban.yaml`. Если в Current — переместить:

```markdown
### Target: API contract codegen

> **Triggers:** активная работа над frontend (≥ 5 endpoint-вызовов из app/), желание исключить ручной impedance mismatch.
>
> - zod-схемы → `zod-to-openapi` → `openapi/scrumban.yaml`.
> - `openapi-typescript` генерирует TS-клиент → `shared/types/api.d.ts`.
> - frontend импортирует только из `shared/types/`, никогда из `server/`.
> - `pnpm codegen` script in `package.json` запускает всю цепочку.

В Current frontend ↔ backend через ad-hoc типы (frontend пока скелет — см. `docs/09-frontend-design.md`).
```

- [ ] **Step 5: Verify**

```bash
grep -nE "server/middleware|server/sse|server/events|server/analytics|server/ff|server/jobs" docs/08-backend-design.md
# Ожидаемо: только в Target-блоках.

grep -nE "shared/types/api\.d\.ts|openapi/scrumban\.yaml|zod-to-openapi|openapi-typescript" docs/08-backend-design.md
# Ожидаемо: только в Target-блоках.
```

- [ ] **Step 6: Commit**

```bash
git add docs/08-backend-design.md
git commit -m "docs(08): backend design — реальная структура server/ + Target codegen и middleware extraction

Current: server/api, server/services, server/db/schema, server/utils — без middleware/sse/events/analytics/ff/jobs папок.
Target: middleware extraction (триггер: 30+ guard'ов), pg-boss workers (триггер: первый async job),
codegen openapi → shared/types/api.d.ts (триггер: активная frontend-разработка)."
```

---

## Task 6: Sync `docs/09-frontend-design.md`

**Files:**
- Modify: `docs/09-frontend-design.md`

**Цель:** Nuxt 3 → 4; убрать BFF к Go API; `frontend/` → monorepo (`app/`).

- [ ] **Step 1: Прочитать файл целиком (~ 19kb, ~470 строк)**

- [ ] **Step 2: Заменить упоминания Nuxt 3 → Nuxt 4**

Найти все вхождения «Nuxt 3» (включая в стеке, в подходе, в структуре):

```bash
grep -n "Nuxt 3" docs/09-frontend-design.md
```

Каждое заменить на «Nuxt 4».

- [ ] **Step 3: Убрать BFF/Go reference**

Найти строку с «BFF (proxy-агрегация к Go API)» (примерно строка 5):

Было: `Server routes Nuxt остаются — используются как BFF (proxy-агрегация к Go API).`
Стало: `Backend и frontend живут в одном Nitro-процессе (monorepo): server-routes Nitro обслуживают `/api/*`, SPA build — статические assets. Прокси-слой не нужен.`

- [ ] **Step 4: Структура проекта — monorepo**

Найти раздел `## Структура проекта` (примерно строка 117+) с блоком `frontend/`. Заменить на:

```markdown
## Структура проекта

Frontend живёт в `app/` корня monorepo (single `package.json`):

```
scrumban_app/
├── app/                            # Nuxt 4 frontend
│   ├── app.vue
│   ├── pages/                      # auto-routing
│   │   ├── index.vue               # dashboard
│   │   ├── auth/login.vue
│   │   ├── auth/register.vue
│   │   ├── workspaces/[wsId]/
│   │   │   ├── boards/[boardId]/index.vue
│   │   │   ├── analytics/index.vue
│   │   │   └── members.vue
│   ├── components/
│   │   ├── board/                  # Column, TaskCard, BoardHeader, ...
│   │   ├── analytics/              # CFDChart, ScatterChart, MonteCarloCard, ...
│   │   ├── ui/                     # GlassCard, GradientHero, MetricCard, ...
│   │   └── layout/                 # AppHeader, AppSidebar, Breadcrumbs
│   ├── composables/                # useAuth, useBoard, useSSE, useTasks, ...
│   ├── stores/                     # Pinia: auth, workspace, board
│   └── assets/css/                 # palette.css, fonts.css
├── server/                         # Nitro backend (см. 08-backend-design)
└── shared/types/                   # общие типы (Nuxt auto-import)
```

`app/` — стандартное расположение для Nuxt 4 (Pages, Components, Composables auto-imported). Frontend никогда не импортирует из `server/` — только через `shared/types/`.
```

- [ ] **Step 5: Sync стек-секции с CLAUDE.md / project_core_decisions**

Найти раздел `## Стек (финальный)` (примерно строка 88+). Убедиться, что все библиотеки соответствуют CLAUDE.md (Nuxt UI v4 — да, vuedraggable@next — да, Inspira UI — да, vue-bits — да). Если что-то расходится — sync.

Дополнительно убедиться, что **нигде не упоминается NextUI / HeroUI** (это для React).

- [ ] **Step 6: Frontend Current vs Target**

В конец файла добавить раздел:

```markdown
## Current vs Target

### Current (Phase 1-3 backend complete; frontend в Phase 4)

`app/app.vue` содержит `<UApp><NuxtPage /></UApp>`. `app/pages/index.vue` — заглушка. **Все pages, components, composables, stores из этого документа — Target Phase 4.**

Необходимые зависимости из стека (`@tanstack/vue-query`, `pinia`, `vuedraggable`, `inspira-ui`, `vue-bits`, `echarts`, `vee-validate`, `@nuxt/icon`, `@nuxt/google-fonts`, `@vueuse/core`) — пока не установлены.

### Target (Phase 4 frontend implementation)

> **Триггер:** Phase 1-3 docs sync завершён → можно переходить к UI без риска переделок.

Реализация frontend по плану из этого документа:
1. Auth flow (login, register).
2. Board view (drag-n-drop задач, real-time SSE).
3. Analytics dashboard (CFD, throughput, Monte Carlo, scatter).
4. Settings, members, sprints.
```

- [ ] **Step 7: Verify**

```bash
grep -nE "Nuxt 3|BFF|Go API|frontend/" docs/09-frontend-design.md
# Ожидаемо: ничего, кроме возможных упоминаний с Target-маркером.

grep -nE "NextUI|HeroUI" docs/09-frontend-design.md
# Ожидаемо: ничего.
```

- [ ] **Step 8: Commit**

```bash
git add docs/09-frontend-design.md
git commit -m "docs(09): frontend design — Nuxt 4 monorepo, app/ структура, без Go BFF

- Nuxt 3 → 4 (последовательно с CLAUDE.md и pivot-spec).
- Структура: monorepo app/ + server/ + shared/, никаких отдельных frontend/.
- Убран BFF/Go API reference (устаревший после pivot 2026-04-23).
- Добавлен раздел Current vs Target — frontend = Phase 4, сейчас skeleton."
```

---

## Task 7: Sync `docs/10-analytics-design.md`

**Files:**
- Modify: `docs/10-analytics-design.md`

**Цель:** убрать Go-пакеты; обновить пороги Monte Carlo под код; cache/jobs/triggers/MV → Target.

- [ ] **Step 1: Прочитать файл целиком**

- [ ] **Step 2: Удалить Go-references**

```bash
grep -n "Go-пакет\|internal/analytics\|montecarlo.go" docs/10-analytics-design.md
```

Каждое упоминание заменить на TypeScript-аналог. Например:

Было: `Реализация: Go-пакет internal/analytics/montecarlo.go`
Стало: `Реализация: `server/services/analytics.service.ts` (функции `computeMonteCarloForecast()` и помощники).`

- [ ] **Step 3: Обновить пороги Monte Carlo**

Найти строку с `«Минимум данных Monte Carlo: ≥3 завершённых спринта или ≥20 закрытых задач за последние 4 недели»`. Заменить:

```markdown
### Минимум данных для прогноза (Current)

Реализация в `analytics.service.ts`:
- `MIN_DAYS_OF_HISTORY = 14` — нужно ≥ 14 дней с любой историей событий.
- Если `totalClosed === 0` за последние 90 дней — возвращаем `insufficient_data`.

Если оба условия выполнены, дневной throughput за 90 дней раскручивается через `expandWithZeros` (дни без закрытий = 0). Затем 1000 итераций bootstrap.

### Target: пороги уровня sprint (Phase 4+)

> **Триггер:** появление таблицы `sprint_stats` с агрегированной velocity → можно требовать «≥ 3 завершённых спринта» как минимум.
```

- [ ] **Step 4: Forecast cache — Target**

Найти упоминания `«on-demand при просмотре спринт-дашборда (результат кэшируется 15 мин)»` или Forecast Cache LRU. Переместить в Target:

```markdown
### Target: forecast caching (Phase 4)

> **Триггер:** Monte Carlo computation latency > 1s p95 (сейчас 50–150 мс на 1000 итераций — без кэша приемлемо).
>
> LRU-кэш в памяти процесса, ключ = `(workspaceId, boardId, tasksRemaining, horizonDays, iterations)`, TTL 15 мин.
> Дополнительно: пересчёт фоновым джобом после каждого `task_closed` в активном спринте.
```

- [ ] **Step 5: Bottleneck detection / percentile alerts → Target**

Найти упоминания bottleneck detection через `cycle_time_samples` p85 и percentile-based stuck-task alerts. Переместить в Target:

```markdown
### Target: bottleneck detection

> **Триггер:** появление таблицы `cycle_time_samples` (один ряд на проход задачи через колонку) с накопленными ≥ 30 проходами per board.
>
> Алгоритм: для каждой колонки считаем p85 времени пребывания → колонка с самым высоким p85 = bottleneck. Дальше показываем «top-N залипших задач» в этой колонке.

### Target: percentile-based stuck alerts

> **Триггер:** ≥ 30 проходов per board (статистическая значимость p95).
>
> Если задача в колонке X дольше p95 исторических проходов — флажок «возможно застряла».
```

- [ ] **Step 6: Verify**

```bash
grep -nE "Go-пакет|internal/analytics|montecarlo\.go" docs/10-analytics-design.md
# Ожидаемо: ничего.

grep -nE "≥3 завершённых спринта|MIN_DAYS_OF_HISTORY|cycle_time_samples|forecast.*кэш" docs/10-analytics-design.md
# Ожидаемо: пороги Current правильные, всё про cycle_time_samples / cache — в Target.
```

- [ ] **Step 7: Commit**

```bash
git add docs/10-analytics-design.md
git commit -m "docs(10): analytics design — без Go-пакетов; пороги Current под код; cache/bottleneck/alerts → Target

- 'Go-пакет internal/analytics/montecarlo.go' → 'server/services/analytics.service.ts'.
- Monte Carlo пороги: 14 days history + totalClosed=0 (соответствие коду).
- Forecast cache (LRU 15 мин) → Target (триггер: p95 > 1s).
- Bottleneck detection p85 → Target (триггер: cycle_time_samples ≥ 30 проходов).
- Percentile-based stuck alerts → Target."
```

---

## Task 8: Sync `docs/05-mvp-scope-and-roadmap.md`

**Files:**
- Modify: `docs/05-mvp-scope-and-roadmap.md`

**Цель:** Phase 1-3 описывают что **реально сделано** в коде; Phase 4-5 — что осталось. Phase 0 — обозначить как пропущенный.

- [ ] **Step 1: Прочитать файл (~12kb)**

- [ ] **Step 2: Phase 0 — пометить пропущенным**

Если Phase 0 описана — добавить заголовок:

```markdown
## Phase 0 (пропущена)

> **Решение от 2026-04-26:** pet-project Phase 0 для освоения TS-backend пропущен. User имеет уверенный TS-фон, реализация началась сразу с Phase 1.
> **Сохранённый план Phase 0:** [`docs/archive/2026-04-23-phase0-week1-nitro-starter.md`](archive/2026-04-23-phase0-week1-nitro-starter.md) — историческая справка.
```

- [ ] **Step 3: Phase 1 — переписать под реальность**

Описать только реализованное:

```markdown
## Phase 1 — RLS Foundation ✅ Завершена

- Postgres 16 + Drizzle setup (миграции через SQL-файлы).
- 9 таблиц: `users`, `workspaces`, `workspace_members`, `boards`, `board_columns`, `tasks`, `task_events`, `sprints`, `sprint_tasks`.
- Row-Level Security (`FORCE ROW LEVEL SECURITY` на 8 tenant-таблицах).
- Two-role Postgres setup: `scrumban` для миграций, `scrumban_app` для рантайма (`NOBYPASSRLS`).
- `withTenant()` helper через `set_config('app.workspace_id', $1, true)` — единственный путь к данным.
- Auth: email/пароль через `nuxt-auth-utils` (scrypt, signed HTTP-only cookie).
- RLS integration tests: cross-tenant access возвращает 0 строк.

### Что **не** сделано в Phase 1 (перенесено в Target)

- ~~`invitations` table + magic-link приглашения~~ → Phase 4+ (триггер: первая команда ≥ 5 человек).
- ~~Восстановление пароля по email~~ → Phase 4+ (триггер: первый публичный регистр).
- ~~`sessions` table + revoke API~~ → Target (триггер: глобальный logout по запросу).
```

- [ ] **Step 4: Phase 2 — переписать**

```markdown
## Phase 2 — Core Domain + Real-time ✅ Завершена

- Boards / columns CRUD с reorder через парковку (offset 10000).
- Tasks lifecycle: state machine (`moveTask`) с обработкой `closedAt`/`reopenedCount`; reopen считается только если task был реально закрыт.
- WIP enforcement (hard, с force=true override) на cross-column moves.
- RBAC: `roleAtLeast`/`strictlyOutranks` единственный источник правды; «last owner» guard.
- Domain errors: `NotFoundError`/`ForbiddenError`/`ConflictError`/`ValidationError`/`UnauthorizedError` + `toHttpError` mapping.
- SSE real-time updates: in-process EventEmitter → SSE клиентам board'а.
- ~38 HTTP endpoint-ов, 124 теста зелёные.

### Что **не** сделано в Phase 2 (перенесено в Target)

- ~~`projects` entity~~ → Target (триггер: workspace ≥ 3 досок одновременно).
- ~~`task_comments`~~ → Target (триггер: команда ≥ 5 человек с регулярными обсуждениями).
- ~~RBAC middleware extraction~~ → Phase 4 cleanup (триггер: 30+ одинаковых guard'ов).
```

- [ ] **Step 5: Phase 3 — переписать**

```markdown
## Phase 3 — Sprints + Analytics ✅ Завершена

- Sprints с state machine (`planned → active → closed/cancelled`); партиальный unique index `WHERE state = 'active'` гарантирует «один активный спринт на доску».
- `sprint_tasks` join table.
- `task_events` лог: `task_created`, `task_moved`, `task_closed`, `task_reopened`, `task_assigned`, `task_updated`, `task_archived`.
- Throughput (rolling).
- Cycle time с min-sample threshold.
- CFD (Cumulative Flow Diagram) — live запрос за 90 дней.
- Monte Carlo bootstrap (1000 итераций, дневной throughput за 90 дней, expandWithZeros для дней без закрытий).
- Little's Law рекомендации.

### Что **не** сделано в Phase 3 (перенесено в Target)

- ~~`flow_daily` aggregate + триггеры~~ → Target (триггер: p95 latency `/analytics/cfd` > 500 мс).
- ~~Materialized views~~ → Target (тот же триггер).
- ~~Sprint events (`sprint_started`, `sprint_closed`, `sprint_cancelled`) в task_events~~ → Target (триггер: дашборд активности команды на уровне спринтов).
- ~~Burndown chart, story points, velocity~~ → Target Phase 4 (триггер: команда ≥ 5 человек, использующих Scrum-составляющую).
- ~~Forecast cache~~ → Target (триггер: p95 MC > 1s).
```

- [ ] **Step 6: Phase 4-5 — переписать как forward-looking realistic**

```markdown
## Phase 4 — Frontend MVP (предстоит)

> **Триггер:** docs/code sync завершён (этот план).

- Auth pages: login, register.
- Board view: columns, draggable task cards, WIP-индикаторы, real-time SSE.
- Task detail panel: title, description, assignees (multi), priority, due date, state.
- Analytics page: CFD, throughput, Monte Carlo, cycle time scatter.
- Settings: workspace, members, RBAC management UI.
- Sprint planning UI.

## Phase 5 — Production-readiness (предстоит)

> **Триггер:** Phase 4 закрыта, MVP готов к показу первому клиенту/комиссии.

- Deploy: Dockerfile + docker-compose.prod.yml + Caddyfile.
- Backup strategy: pg_dump nightly → Object Storage.
- Observability: pino + requestId middleware.
- CI: GitHub Actions / GitFlic CI (typecheck + vitest + build на push).
- Rate limit на /api/auth/login.

## Phase 6+ (Target / по запросу)

Список вынесен в [`docs/07-domain-model.md`](07-domain-model.md#target-phase-4) и [`docs/11-non-functional.md`](11-non-functional.md). Ключевые блоки: projects, comments, attachments, magic-link invitations, sessions table + revoke, 2FA, SSO, audit log, billing, Telegram-бот, on-prem pack, ML-extension.
```

- [ ] **Step 7: Verify**

```bash
grep -nE "Phase 1|Phase 2|Phase 3|Phase 4|Phase 5" docs/05-mvp-scope-and-roadmap.md | head -20
# Ожидаемо: 1-3 ✅ Завершена, 4+ предстоит.
```

- [ ] **Step 8: Commit**

```bash
git add docs/05-mvp-scope-and-roadmap.md
git commit -m "docs(05): roadmap — Phase 1-3 как завершённые с реальным scope; Phase 4+ как forward-looking

- Phase 1: RLS + 9 таблиц + auth (без invitations/recovery — Target).
- Phase 2: domain + real-time SSE (без projects/comments — Target).
- Phase 3: analytics на task_events (без MV/aggregates/sprint events — Target).
- Phase 4: frontend MVP.
- Phase 5: production-readiness (deploy/backup/CI/observability)."
```

---

## Task 9: Quick scan и sync `docs/01-04` + `docs/12`

**Files:**
- Modify (если нужно): `docs/01-vision-and-goals.md`, `docs/02-target-audience.md`, `docs/03-competitive-analysis.md`, `docs/04-economic-rationale.md`, `docs/12-deployment.md`

**Цель:** проверить, нет ли в этих документах упоминаний Go / Nuxt 3 / 4 ролей / устаревшего стека.

- [ ] **Step 1: Grep по ключевым устаревшим терминам**

```bash
grep -nE "Go|Nuxt 3|argon2id|4 роли|monte-carlo.go|internal/analytics|extractWorkspaceFromPath|pg-boss(?! как Target)" \
  docs/01-vision-and-goals.md docs/02-target-audience.md docs/03-competitive-analysis.md \
  docs/04-economic-rationale.md docs/12-deployment.md
```

- [ ] **Step 2: Для каждого нужного файла — открыть и прочитать**

- [ ] **Step 3: Внести правки**

Если упоминается «backend на Go», заменить на «backend на Node.js (Nitro)». Если упоминается Nuxt 3 — на Nuxt 4. Если 4 роли — на 5 (или линк на `roles-guide.md`).

- [ ] **Step 4: Commit (один коммит на все мелкие правки)**

```bash
git add docs/01-vision-and-goals.md docs/02-target-audience.md docs/03-competitive-analysis.md docs/04-economic-rationale.md docs/12-deployment.md
git status  # проверить, что ничего лишнего
git commit -m "docs(01-04, 12): quick scan — sync устаревших упоминаний (Go → Nitro, Nuxt 3 → 4, 4 → 5 ролей)"
```

(Если grep не нашёл ничего — закоммитить пустую правку не нужно, пропустить.)

---

## Task 10: Sync `docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`

**Files:**
- Modify: `docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`

**Цель:** структура папок в pivot-spec — пометить, что реализовано (`server/api/`, `server/services/`, `server/db/`, `server/utils/`) vs Target (`server/middleware/`, `server/jobs/`, `openapi/`, `shared/types/api.d.ts`).

- [ ] **Step 1: Прочитать файл целиком**

- [ ] **Step 2: В разделе «Структура проекта» добавить аннотации**

Найти ASCII-блок «Структура проекта» (примерно строки 41–75 в текущей версии). Добавить inline-аннотации:

```
scrumban/
├── app/                          # Nuxt frontend ✅ skeleton; полноценный — Phase 4
├── server/                       # Nitro backend
│   ├── api/                      # ✅ ~38 endpoints
│   ├── services/                 # ✅ tasks, sprints, analytics, rbac, workspace-members
│   ├── db/
│   │   ├── schema/               # ✅ 9 tables (Phase 1-3)
│   │   └── queries/              # ⚠️ Target — пока запросы прямо в services
│   ├── jobs/                     # ⚠️ Target — pg-boss не установлен (триггер: первый async job)
│   ├── middleware/               # ⚠️ Target — Phase 4 cleanup (триггер: 30+ одинаковых guard'ов)
│   └── utils/                    # ✅ db.ts, errors.ts, event-bus.ts
├── shared/                       # ✅ types/auth.d.ts (расширение nuxt-auth-utils)
│   └── types/                    # ⚠️ api.d.ts — Target (codegen из openapi)
├── openapi/
│   └── scrumban.yaml             # ⚠️ Target — zod-to-openapi не подключён
└── drizzle/
    └── migrations/               # ✅ SQL-файлы коммитятся
```

Легенда: ✅ реализовано в Phase 1-3 / ⚠️ Target.

- [ ] **Step 3: Verify**

Прочитать обновлённый блок, убедиться, что разметка корректна.

- [ ] **Step 4: Commit**

```bash
git add docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md
git commit -m "docs(pivot-spec): аннотировать структуру — реализовано Phase 1-3 vs Target

Каждая папка в server/ помечена ✅ (реализована) или ⚠️ Target (с триггером ввода).
Pivot-spec остаётся master'ом, но теперь честно отражает, что часть структуры — план."
```

---

## Task 11: UML — sync `03-er/database.puml` (Current)

**Files:**
- Modify: `docs/uml/03-er/database.puml`
- Modify (если есть): `docs/uml/03-er/database.md`

**Цель:** одна правда в Current-диаграмме — 9 реальных таблиц.

- [ ] **Step 1: Прочитать существующий `database.puml`**

- [ ] **Step 2: Перерисовать под 9 таблиц**

Удалить из диаграммы entities: `projects`, `task_tags`, `task_comments`, `task_attachments`, `invitations`, `sessions`, `feature_flags`, `events` (универсальная), `flow_daily`, `cycle_time_samples`, `sprint_stats`, `audit_log`.

Оставить и привести в соответствие коду:
- `users` (id, email, password_hash, created_at, updated_at — без name/avatar/locale/last_seen)
- `workspaces` (id, name, slug UNIQUE, created_at, updated_at — без plan/owner_id/settings/archived_at)
- `workspace_members` (id, workspace_id FK, user_id FK, role enum: viewer/member/scrum_master/admin/owner, created_at) + UNIQUE (workspace_id, user_id)
- `boards` (id, workspace_id FK, name, slug, created_at, updated_at — без project_id/type)
- `board_columns` (id, board_id FK, name, position, column_role enum: backlog/in_progress/review/done/archived, wip_limit nullable, created_at — без is_terminal/wip_strict)
- `tasks` (id, board_id FK, column_id FK, title, description, position, priority enum: low/medium/high, assignee_id FK nullable, closed_at nullable, reopened_count int, archived_at nullable, created_at, updated_at — без project_id/sprint_id/short_id/type/story_points/estimate_hours/reporter_id)
- `task_events` (id, workspace_id, task_id FK CASCADE, event_type, from_column_id nullable, to_column_id nullable, payload jsonb, actor_user_id, created_at)
- `sprints` (id, board_id FK, name, goal, planned_start_at, planned_end_at, started_at nullable, ended_at nullable, state enum: planned/active/closed/cancelled, created_at, updated_at — без project_id/created_by/closed_at)
- `sprint_tasks` (sprint_id FK, task_id FK, added_at) + PK (sprint_id, task_id)

Связи (минимальные, без projects):
```
users ||--o{ workspace_members
workspaces ||--o{ workspace_members
workspaces ||--o{ boards
boards ||--o{ board_columns
boards ||--o{ tasks
board_columns ||--o{ tasks
tasks ||--o{ task_events
boards ||--o{ sprints
sprints ||--o{ sprint_tasks
tasks ||--o{ sprint_tasks
users ||--o{ tasks (assignee)
users ||--o{ task_events (actor)
```

В footer диаграммы добавить:
```
note bottom
  Current ER (Phase 1-3 MVP). Соответствует server/db/schema/.
  Расширенная Target версия: target/database.puml.
end note
```

- [ ] **Step 3: Прочитать `database.md` если существует**

```bash
ls docs/uml/03-er/
```

Если есть — обновить описание под 9 таблиц.

- [ ] **Step 4: Verify рендером**

```bash
plantuml -tsvg docs/uml/03-er/database.puml
ls docs/uml/03-er/database.svg  # должен сгенерироваться без ошибок
```

(Если PlantUML CLI недоступен — открыть в IDE с PlantUML plugin и проверить preview.)

- [ ] **Step 5: Commit**

```bash
git add docs/uml/03-er/database.puml docs/uml/03-er/database.md docs/uml/03-er/database.svg
git commit -m "docs(uml/er): Current ER — 9 таблиц, соответствие server/db/schema/

Удалены проекции на нереализованные entities (projects/comments/attachments/tags/
invitations/sessions/feature_flags/events-universal/flow_daily/cycle_time_samples/
sprint_stats/audit_log). Поля приведены к реальным (priority low/medium/high,
column_role с archived без other, 5 ролей, без short_id/type/story_points)."
```

---

## Task 12: UML — создать `03-er/target/database.puml` (Target)

**Files:**
- Create: `docs/uml/03-er/target/`, `docs/uml/03-er/target/database.puml`, `docs/uml/03-er/target/database.md`

**Цель:** target ER = full vision (~ 20 entities + 3 MV) — для главы «Эволюция архитектуры».

- [ ] **Step 1: Создать папку**

```bash
mkdir -p docs/uml/03-er/target
```

- [ ] **Step 2: Создать `target/database.puml`**

В файл записать ER со всеми 11 Target-сущностями + 3 materialized view, в стиле Current-диаграммы. Каждая Target-сущность в отдельной visual group или с цветовой пометкой (`<<future>>` стереотип, скажем, окраска `#fde68a`).

```plantuml
@startuml
!theme plain
title Target ER — Phase 4+ (включает обоснованно отложенные entities)

skinparam class {
  BackgroundColor<<future>> #fde68a
  BorderColor<<future>> #b45309
}

' ===== Current (Phase 1-3) =====
entity users {}
entity workspaces {}
entity workspace_members {}
entity boards {}
entity board_columns {}
entity tasks {}
entity task_events {}
entity sprints {}
entity sprint_tasks {}

' ===== Target (Phase 4+) =====
entity projects <<future>> {
  * id : uuid
  * workspace_id : uuid
  * name : text
  key : text
  archived_at : timestamptz
}
entity task_comments <<future>> { ... }
entity task_attachments <<future>> { ... }
entity task_tags <<future>> { ... }
entity invitations <<future>> { ... }
entity sessions <<future>> { ... }
entity feature_flags <<future>> { ... }
entity audit_log <<future>> { ... }

' ===== Materialized views (Phase 4+ optimization) =====
entity mv_cfd_last_90d <<future>> { ... }
entity mv_throughput_weekly <<future>> { ... }
entity mv_cycle_time_percentiles <<future>> { ... }

' Связи: проекции на projects (boards.project_id, sprints.project_id, tasks.project_id) etc.

note bottom
  Желтые entities = Target (Phase 4+).
  Каждая имеет триггер ввода — см. docs/07-domain-model.md.
end note
@enduml
```

(Полный синтаксис написать аккуратно с реальными полями каждой entity — взять из 07-domain-model.md Target раздела.)

- [ ] **Step 3: Создать `target/database.md`**

Короткое описание (≤ 1 страница): что показывает Target, чем отличается от Current, ссылка на триггеры в 07-domain-model.

- [ ] **Step 4: Verify рендером**

```bash
plantuml -tsvg docs/uml/03-er/target/database.puml
```

- [ ] **Step 5: Commit**

```bash
git add docs/uml/03-er/target/
git commit -m "docs(uml/er): Target ER — полная vision (Phase 4+) с обоснованно отложенными entities

Включает 11 Target-сущностей (projects, comments, attachments, tags, invitations,
sessions, feature_flags, audit_log) + 3 materialized view + поля, расширяющие
существующие таблицы (boards.project_id, tasks.short_id, etc.).
Использует <<future>> стереотип для визуального отделения от Current."
```

---

## Task 13: UML — sync `02-class/domain-classes.puml`

**Files:**
- Modify: `docs/uml/02-class/domain-classes.puml`
- Modify (если есть): `docs/uml/02-class/domain-classes.md`

**Цель:** Class-диаграмма = Current code. Удалить лишние классы и enums. Без отдельной target версии.

- [ ] **Step 1: Прочитать существующий**

- [ ] **Step 2: Удалить:**
- Классы: `Project`, `TaskTag`, `TaskComment`, `TaskAttachment`, `Invitation`, `Session`, `FeatureFlag`.
- Enums: `WorkspacePlan`, `BoardType`, `TaskType`.

- [ ] **Step 3: Скорректировать:**
- `Role` enum: 5 значений (`Viewer`, `Member`, `ScrumMaster`, `Admin`, `Owner`).
- `ColumnRole` enum: 5 значений (`Backlog`, `InProgress`, `Review`, `Done`, `Archived`). Без `Other`.
- `TaskPriority` enum: `Low`, `Medium`, `High`. Без `Normal`/`Urgent`.

- [ ] **Step 4: Скорректировать поля классов**
Под Current (см. ER в Task 11). Например, `Task` без `projectId/sprintId/shortId/type/storyPoints/estimateHours/reporterId`.

- [ ] **Step 5: Note внизу**

```
note bottom
  Class diagram отражает Current domain model (Phase 1-3 MVP).
  Расширения (Project, TaskComment, TaskAttachment, Invitation, Session, FeatureFlag)
  описаны как Target в docs/07-domain-model.md и docs/uml/03-er/target/.
end note
```

- [ ] **Step 6: Verify рендером + commit**

```bash
plantuml -tsvg docs/uml/02-class/domain-classes.puml
git add docs/uml/02-class/
git commit -m "docs(uml/class): Class diagram → Current domain (9 entities, 5 ролей, корректные enums)

Удалены классы Project/TaskTag/TaskComment/TaskAttachment/Invitation/Session/FeatureFlag,
enums WorkspacePlan/BoardType/TaskType. Скорректированы Role (5), ColumnRole (5 с Archived),
TaskPriority (low/medium/high). Поля Task/Sprint приведены к реальной схеме."
```

---

## Task 14: UML — sync `04-component/components.puml` (Current)

**Files:**
- Modify: `docs/uml/04-component/components.puml`
- Modify (если есть): `docs/uml/04-component/components.md`

**Цель:** Current component diagram без pg-boss/Worker/Aggregator/LISTEN-NOTIFY/Email Sender.

- [ ] **Step 1: Прочитать существующий**

- [ ] **Step 2: Удалить components**
- `Worker` (pg-boss с поддиаграммами WkWebhook/WkEmail/WkAgg/WkMC).
- `Aggregator`.
- `Email Sender`.
- `LISTEN/NOTIFY Bridge`.
- `Webhook Dispatcher`.
- `Feature Flags`.
- `MC Refresh`.
- External services: SMTP, Bot (Telegram/Pachca), Git Platform.
- В DB-tier: `Aggregates + mat.views`, `pg-boss (job queue)`, `LISTEN/NOTIFY channel`, `events (append-only)` универсальная.

- [ ] **Step 3: Оставить и скорректировать**
- Browser (Nuxt 4 SPA — пока skeleton, помечено).
- Caddy — пометить как «планируется в Phase 5» (не задеплоено).
- Nitro Server: H3 router, in-handler RBAC + tenant, services, in-process EventBus, SSE hub, analytics engine (live).
- PostgreSQL: tenant data, RLS, task_events log.

- [ ] **Step 4: Note**

```
note bottom
  Current component diagram (Phase 1-3 MVP).
  Будущие компоненты (pg-boss workers, Aggregator, Email Sender, LISTEN/NOTIFY,
  Webhook Dispatcher) — см. target/components.puml.
end note
```

- [ ] **Step 5: Verify + commit**

```bash
plantuml -tsvg docs/uml/04-component/components.puml
git add docs/uml/04-component/components.puml docs/uml/04-component/components.md docs/uml/04-component/components.svg
git commit -m "docs(uml/component): Current component — реальные компоненты Phase 1-3 без pg-boss/Aggregator/LISTEN-NOTIFY

Удалены Worker/Aggregator/Email Sender/Webhook Dispatcher/Feature Flags/MC Refresh,
external SMTP/Bot/Git Platform. Caddy помечена как Phase 5 (deploy work).
Target-версия — отдельный файл target/components.puml."
```

---

## Task 15: UML — создать `04-component/target/components.puml` (Target)

**Files:**
- Create: `docs/uml/04-component/target/`, `docs/uml/04-component/target/components.puml`, `docs/uml/04-component/target/components.md`

- [ ] **Step 1: Создать папку**

```bash
mkdir -p docs/uml/04-component/target
```

- [ ] **Step 2: Записать target-версию**

Включить в неё все компоненты из Current + добавить:
- pg-boss workers (внутри Nitro): WkWebhook, WkEmail, WkAgg, WkMC.
- Aggregator service.
- Email Sender (нацелен на SMTP).
- LISTEN/NOTIFY Bridge.
- Webhook Dispatcher (нацелен на external HTTP).
- Feature Flags service.
- External: SMTP, Bot (Telegram/Pachca), Object Storage (для attachments + backups).
- DB-tier: добавить flow_daily/MV/pg-boss queue/LISTEN-NOTIFY channel.
- Caddy с sticky sessions.

Каждый Target-компонент пометить стереотипом `<<future>>` + цветом.

- [ ] **Step 3: Создать `target/components.md`**

Описание: какие компоненты добавляются, по каким триггерам (триггеры — копировать из 06-system-architecture.md и 11-non-functional.md).

- [ ] **Step 4: Verify + commit**

```bash
plantuml -tsvg docs/uml/04-component/target/components.puml
git add docs/uml/04-component/target/
git commit -m "docs(uml/component): Target component — полная архитектура с pg-boss/Aggregator/Email/LISTEN-NOTIFY/Webhook"
```

---

## Task 16: UML — sync 3 sequence diagrams

**Files:**
- Modify: `docs/uml/06-sequence/login.puml`
- Modify: `docs/uml/06-sequence/create-task-sse.puml`
- Modify: `docs/uml/06-sequence/monte-carlo.puml`
- Modify (если есть): `*.md` к каждой

- [ ] **Step 1: `login.puml`**

Заменить sequence-флоу:
- Path: `/api/auth/login` (без `/v1`).
- Удалить шаги с `INSERT INTO sessions(...)`, `random session token (256-bit)`, `SHA-256 хэширование`.
- Заменить шаг хэширования: `verifyPassword(password, hash)` через nuxt-auth-utils → scrypt.
- Заменить Set-Cookie шаг: `setUserSession(event, { user: { id, email } })` (внутри nuxt-auth-utils, signed HTTP-only cookie).
- Удалить шаг `Pinia auth.setUser(user)` (Pinia не подключён) — заменить на «Frontend сохраняет session через `useUserSession()` composable» (или просто пометить «Frontend state — Phase 4»).

```bash
plantuml -tsvg docs/uml/06-sequence/login.puml
```

- [ ] **Step 2: `create-task-sse.puml`**

- Path: `POST /api/workspaces/{id}/boards/{boardId}/tasks` (без `v1`, без `projects`).
- SSE path: `GET /api/workspaces/{id}/boards/{boardId}/stream`.
- В payload — нет `project_id` (удалить).
- `INSERT INTO task_events(workspace_id, task_id, event_type, from_column_id, to_column_id, payload, actor_user_id, created_at)` — реальные колонки (не universal events).
- Удалить шаги с `Worker (pg-boss)` enqueue Telegram/Pachca — заменить на in-process EventEmitter → SSE clients.

- [ ] **Step 3: `monte-carlo.puml`**

- Path: `GET /api/workspaces/{id}/boards/{boardId}/analytics/monte-carlo` (без `v1`).
- Параметры: query string `?tasksRemaining=N&horizonDays=D&iterations=K` (а не из БД спринта).
- Удалить шаги с Forecast Cache (LRU 15 мин) — заменить на in-line вычисление.
- Источник истории: `task_events` за 90 дней, дневной throughput с `expandWithZeros` (а не `sprint_stats`/`mv_throughput_weekly`).
- Threshold: `< 14 дней с историей` или `0 закрытых за 90 дней` → `insufficient_data`.
- Удалить шаги с `CountRemainingTasks(sprintId) WHERE sprint_id=$1` — `sprint_id` на task'ах нет.

- [ ] **Step 4: Verify**

```bash
for f in docs/uml/06-sequence/login.puml docs/uml/06-sequence/create-task-sse.puml docs/uml/06-sequence/monte-carlo.puml; do
  plantuml -tsvg "$f"
done
ls docs/uml/06-sequence/*.svg
```

- [ ] **Step 5: Commit**

```bash
git add docs/uml/06-sequence/
git commit -m "docs(uml/sequence): три sequence-диаграммы → Current API/code paths

login: убрать sessions table + SHA-256, заменить на nuxt-auth-utils signed cookie + scrypt;
       Pinia → Phase 4; путь /api/auth/login.
create-task-sse: реальные пути (workspaces/[id]/boards/[boardId]/tasks); task_events со
                 спецколонками; убрать pg-boss worker → in-process EventEmitter.
monte-carlo: реальный путь и query params; убрать forecast cache; пороги 14d/0closed;
             источник = task_events дневной throughput, не sprint_stats."
```

---

## Task 17: UML — sync `01-use-case/use-case.puml` + per-role

**Files:**
- Modify: `docs/uml/01-use-case/use-case.puml`
- Modify: `docs/uml/01-use-case/per-role/*.puml` (все 5)
- Modify (если есть): `*.md`

**Цель:** Current use-cases — без стереотипа; нереализованные UC — `<<Future>>` стереотипом.

- [ ] **Step 1: Открыть `use-case.puml`**

- [ ] **Step 2: Пометить нереализованные UC стереотипом `<<Future>>`**

Список Future-UC (из аудита раздел 4.7):
- `UC_AcceptInvite`
- `UC_AttachFile`
- `UC_CommentTask`
- `UC_LinkCommit`
- `UC_RecomputeAgg`
- `UC_UpdateMC`
- `UC_CreateProject`
- `UC_ArchiveProject`
- `UC_SendEmail`
- `UC_SendNotification`
- `UC_ResetPwd`
- `UC_EditProfile`
- `UC_ViewBottleneck`
- `UC_CompareSprints`
- `UC_ViewScatter`
- `UC_WSSettings`
- `UC_ArchiveWS`

Каждое определение UC заменить на `usecase "Comment Task" as UC_CommentTask <<Future>>`.

В styling блоке диаграммы добавить:
```
skinparam usecase {
  BackgroundColor<<Future>> #fde68a
  BorderColor<<Future>> #b45309
}
```

- [ ] **Step 3: External actors → пометить как Future**

`SMTP`, `Bot` (Telegram/Pachca), `Git Platform`, `Cron` — внешние акторы, интеграций нет. Стереотип `<<Future>>`.

- [ ] **Step 4: Note внизу**

```
note bottom
  Желтые use-cases / actors = Future (Phase 4+).
  Текущая реализация (Phase 1-3) покрывает auth, workspace, RBAC, boards, tasks,
  sprints, аналитику. См. docs/05-mvp-scope-and-roadmap.md для маппинга.
end note
```

- [ ] **Step 5: Per-role диаграммы (5 файлов в `per-role/`)**

```bash
ls docs/uml/01-use-case/per-role/
```

В каждом per-role файле — те же стереотипы `<<Future>>` для нереализованных UC.

- [ ] **Step 6: Verify рендером**

```bash
for f in docs/uml/01-use-case/use-case.puml docs/uml/01-use-case/per-role/*.puml; do
  plantuml -tsvg "$f"
done
```

- [ ] **Step 7: Commit**

```bash
git add docs/uml/01-use-case/
git commit -m "docs(uml/use-case): пометить нереализованные UC + external actors стереотипом <<Future>>

UC_AcceptInvite/AttachFile/CommentTask/LinkCommit/RecomputeAgg/UpdateMC/CreateProject/
ArchiveProject/SendEmail/SendNotification/ResetPwd/EditProfile/ViewBottleneck/
CompareSprints/ViewScatter/WSSettings/ArchiveWS — все помечены <<Future>>.
External SMTP/Bot/Git Platform/Cron — также Future.
Per-role диаграммы (5 файлов) синхронизированы с тем же стереотипом."
```

---

## Task 18: UML — fix `07-state/*.puml`

**Files:**
- Modify: `docs/uml/07-state/task-lifecycle.puml`
- Modify: `docs/uml/07-state/sprint-lifecycle.puml`

**Цель:** мелкие правки соответствия коду.

- [ ] **Step 1: `task-lifecycle.puml` правки**

Найти и заменить:
- `task_moved_column` → `task_moved` (имя event'а в коде).
- Из Archived: убрать `entry / set deleted_at = now()` — нет soft delete на task; archived = просто `column_role='archived'`.
- Backlog → [*] правило: «delete (только если невыполнено любой работы и роль = Admin)» — заменить на «hard delete доступен admin без проверки 'не было работы'» (соответствует коду — задокументировать как known limitation).

- [ ] **Step 2: `sprint-lifecycle.puml` правки**

- Sprint events (`sprint_started`, `sprint_closed`, `sprint_cancelled`) в task_events — пометить как Target (триггер: дашборд активности команды).
- SSE broadcast `sprint_started` — пометить как Target (SSE для sprints не реализован).
- Trigger `sprint_stats` пересчёт — пометить как Target (таблицы нет).
- «задачи unclosed → rollover в следующий Planned sprint» — пометить как Target (триггер: Sprint planning UI Phase 4).

Можно через стереотип `<<future>>` на конкретных переходах/действиях.

- [ ] **Step 3: Verify + commit**

```bash
plantuml -tsvg docs/uml/07-state/task-lifecycle.puml
plantuml -tsvg docs/uml/07-state/sprint-lifecycle.puml
git add docs/uml/07-state/
git commit -m "docs(uml/state): minor fixes — task_moved (не task_moved_column); архивация без soft delete; sprint events/SSE/rollover как Target"
```

---

## Task 19: UML — заглушка для `05-deployment/` + sync `docs/uml/README.md`

**Files:**
- Create: `docs/uml/05-deployment/README.md`
- Modify: `docs/uml/README.md`

- [ ] **Step 1: Создать `05-deployment/README.md`**

```markdown
# 05 — Deployment Diagram

> **Status:** не создана. Будет добавлена при работе над Phase 5 (production deployment).
>
> **Триггер:** выбор финального хостинга (Yandex Cloud VM vs другой), конфигурация Caddy + docker-compose.prod, документирование backups и WAL-archiving.
>
> **Что покажет:** physical deployment — VM, Docker containers (Nitro, Postgres, MinIO), Caddy reverse-proxy, backup-target, для двух режимов (SaaS multi-tenant + on-prem single-tenant).
```

- [ ] **Step 2: Sync `docs/uml/README.md`**

В таблице диаграмм:
- Строка про Component: убрать «Go» из стека → оставить «Nuxt / Postgres / Storage / Caddy».
- Строка про Deployment: статус «не создана, Phase 5» (или явная пометка).

В разделе «Связанные документы» (примерно строка 72+):
- Заменить ссылку `../superpowers/specs/2026-04-18-scrumban-platform-design.md` (master spec) на `../superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`.
- Добавить ссылку на `../archive/2026-04-18-scrumban-platform-design.md` как «архивированный Go-spec для главы об эволюции архитектуры».

В разделе «Принципы работы с диаграммами» убедиться, что нет упоминаний устаревших артефактов.

- [ ] **Step 3: Verify**

```bash
grep -nE "2026-04-18-scrumban-platform-design|Go" docs/uml/README.md
# Ожидаемо: только в строке-ссылке на archive (с пометкой архив).
```

- [ ] **Step 4: Commit**

```bash
git add docs/uml/05-deployment/ docs/uml/README.md
git commit -m "docs(uml): deployment placeholder + README sync

- 05-deployment/: заглушка README с триггером (Phase 5).
- README: убрать 'Go' из Component-строки; ссылка master spec → pivot;
  ссылка на archived Go-spec помечена как историческая."
```

---

## Task 20: Update `COMPACT.md`

**Files:**
- Modify: `COMPACT.md`

- [ ] **Step 1: Прочитать текущий `COMPACT.md`**

- [ ] **Step 2: Добавить запись в «Что сделано»**

Под раздел «Что сделано» добавить (датой 2026-05-10 или текущей):

```markdown
### 2026-05-10 — Docs/code sync (план `2026-05-10-docs-code-sync.md`)

- Архив: `docs/archive/` создан, перенесены Go-spec и Phase 0 plan с migration header'ами.
- Numbered docs (07, 06, 11, 08, 09, 10, 05) переведены в формат Current + Target с триггерами.
- Master pivot-spec — структура папок аннотирована (✅ реализовано / ⚠️ Target).
- UML: ER, Class, Component, 3 sequence, use-case, 2 state — приведены к Current; для ER и Component созданы target/-варианты с <<future>> стереотипом.
- 05-deployment/ заглушка с триггером Phase 5.
- Code comments fix: scrypt (не argon2id), set_config (не SET LOCAL).

**Эффект:** документация теперь честно отражает реализацию; всё откладываемое имеет триггер ввода.
```

- [ ] **Step 3: Обновить «Что дальше»**

```markdown
### Что дальше

1. **Phase 4 — Frontend MVP** (по плану в `docs/09-frontend-design.md`).
   Триггер: docs sync завершён ✅.

2. **Code quality issues (отдельный мини-PR):**
   - `task_events` ON DELETE CASCADE → SET NULL + task_id_snapshot (сохранить аналитику при hard-delete task).
   - `assertNotLastOwner` — добавить ROW LOCK для защиты от race condition.
   - `deleteSprint` — атомарная проверка state.

3. **Phase 5 prep**: Dockerfile + Caddyfile + docker-compose.prod + pg_dump nightly.
```

- [ ] **Step 4: Commit**

```bash
git add COMPACT.md
git commit -m "docs(COMPACT): обновить после docs/code sync (план 2026-05-10)

Что сделано: архив + 7 numbered docs + pivot-spec + UML (Current + 2 target) + code comments.
Что дальше: Phase 4 (frontend MVP), code quality mini-PR (CASCADE/race/atomic-checks), Phase 5 prep."
```

---

## Task 21: Финальная верификация

**Files:** none modified — только проверка консистентности.

- [ ] **Step 1: Grep на устаревшие термины**

```bash
echo "=== Go references (должны быть только в archive/) ==="
grep -rn "Go-пакет\|на Go\|backend на Go\|Go API\|internal/analytics\|montecarlo\.go" docs/ --include="*.md" | grep -v "archive/"

echo "=== Nuxt 3 (должно быть пусто) ==="
grep -rn "Nuxt 3" docs/ --include="*.md" | grep -v "archive/"

echo "=== argon2id как нашей реализации (только опции / archive) ==="
grep -rn "argon2id" docs/ --include="*.md" | grep -v "archive/" | grep -v "опционально"

echo "=== 4 роли (должно быть пусто или с пометкой устаревшего) ==="
grep -rn "4 роли\|четыре роли" docs/ --include="*.md" | grep -v "archive/"

echo "=== extractWorkspaceFromPath (должно быть только в Target-блоках) ==="
grep -rn "extractWorkspaceFromPath" docs/ --include="*.md"

echo "=== pg-boss без Target-маркера (должно быть только в Target-разделах) ==="
grep -rnB2 "pg-boss" docs/ --include="*.md" | grep -v "Target\|архив\|archive\|⚠️\|<<future>>"
```

Любое неожиданное вхождение — пофиксить.

- [ ] **Step 2: Grep code-comments**

```bash
grep -rn "argon2id" server/ --include="*.ts"
grep -rn "SET LOCAL" server/ --include="*.ts"
```

Должны быть пусты или только в новых описывающих комментариях.

- [ ] **Step 3: Запустить полный test suite**

```bash
bun test
```

Ожидаемо: 124 теста зелёные. Никаких регрессий от code-comment правок.

- [ ] **Step 4: PlantUML render-check (опционально)**

```bash
for d in docs/uml/01-use-case docs/uml/02-class docs/uml/03-er docs/uml/03-er/target docs/uml/04-component docs/uml/04-component/target docs/uml/06-sequence docs/uml/07-state; do
  for f in "$d"/*.puml; do
    [ -f "$f" ] && plantuml -tsvg "$f" 2>&1 | grep -i error
  done
done
```

Ожидаемо: ничего.

- [ ] **Step 5: Финальный коммит (если что-то найдено)**

```bash
git status
git add ...
git commit -m "docs: final cleanup after docs/code sync verification"
```

---

## Self-Review

**Spec coverage check:**

| Audit раздел | Закрывается в Task |
|--------------|---------------------|
| 1.1 Сущности в docs, нет в коде | Task 2 (07-domain), Task 12 (target ER), Task 13 (class) |
| 1.2 Materialized views | Task 2, Task 12 |
| 1.3 events vs task_events | Task 2 (Target раздел в 07-domain) |
| 1.4 Поля схемы расходятся | Task 2, Task 11 (current ER), Task 13 |
| 2.1 MUST gaps | Task 8 (05-roadmap Target), Task 17 (use-case Future) |
| 2.2 SHOULD gaps | Task 8, Task 17 |
| 2.3 LATER gaps | Task 8, Task 17 |
| 3.1–3.9 NFR gaps | Task 4 (11-NFR Target секции с триггерами) |
| 4.1 ER diagram | Task 11, Task 12 |
| 4.2 Class diagram | Task 13 |
| 4.3 Component diagram | Task 14, Task 15 |
| 4.4–4.6 Sequence diagrams | Task 16 |
| 4.7 Use-case | Task 17 |
| 4.8 State machines | Task 18 |
| 4.9 Deployment пустая | Task 19 |
| 5. Внутренние расхождения docs | Task 2-9 (все sync-задачи) |
| 6. Code comments | Task 1 |
| 7. Code quality issues | **Не закрывается этим планом** — выписан в COMPACT (Task 20) как отдельный mini-PR. |
| 8. Frontend gap | **Не закрывается этим планом** — отмечено в 09-frontend-design.md и 05-roadmap как Phase 4 (Task 6, 8). |
| 9. Test coverage gaps | **Не закрывается этим планом** — выписан в COMPACT как отдельная работа. |
| 10. Прочие inconsistencies | Task 0 (archive), Task 19 (UML README), Task 9 (quick scan 01-04) |

**Не закрытые этим планом (по дизайну):**
- Раздел 7 (code quality race conditions, CASCADE) — отдельный mini-PR.
- Раздел 8 (frontend) — Phase 4 implementation, отдельный план после этого.
- Раздел 9 (test coverage) — отдельная работа после Phase 4 frontend.

**Placeholder scan:** план содержит конкретные edit-инструкции с шаблонами текста. Где «прочитать файл, найти секцию X, заменить на Y» — это читабельно для исполнителя; шаблоны Y приведены в plan'е дословно.

**Type/name consistency check:**
- Имена ролей единообразно: `viewer/member/scrum_master/admin/owner` (snake) или `Viewer/Member/ScrumMaster/Admin/Owner` (Pascal в class diagram). Двух разных вариантов в одном артефакте нет.
- Имена events: `task_created`, `task_moved`, `task_closed`, `task_reopened`, `task_assigned`, `task_updated`, `task_archived` (НЕ `task_moved_column`).
- API path соглашение: `/api/...` (без `/v1`).
- Стереотип Future: `<<Future>>` в use-case, `<<future>>` в class/component/ER (Title-case в use-case по правилам PUML примеров).

**Spec coverage gap, который добавляется:** ничего нового добавлять не надо, всё ранее идентифицированное покрыто.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-10-docs-code-sync.md`. Two execution options:

**1. Subagent-Driven (recommended)** — диспетчеризую fresh subagent на каждую задачу, ревью между задачами, быстрая итерация.

**2. Inline Execution** — выполняю задачи в текущей сессии через executing-plans skill, batch-выполнение с checkpoint'ами для ревью.

Какой подход?
