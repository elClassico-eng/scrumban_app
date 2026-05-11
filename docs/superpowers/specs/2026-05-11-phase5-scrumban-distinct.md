# Phase 5 — Scrumban-distinct features (T1)

**Date:** 2026-05-11.
**Trigger:** Phase 4.5 merged into `main` (`77db348`); pillar-gap analysis in [`docs/05-mvp-scope-and-roadmap.md`](../../05-mvp-scope-and-roadmap.md) §3 showed 0 of 9 Scrumban-specific methodology practices implemented — the product is currently Kanban+sprints, not Scrumban. This phase closes that overclaim.

## §1 Vision pillars advanced (mandatory check)

Per memory `feedback_vision_check.md`: every Phase spec must explicitly map scope to vision pillars before any code is written. If §1 is empty or thin, the phase is mis-scoped.

| Vision pillar | Item from `01-vision-and-goals.md` | Phase 5 deliverable |
|---|---|---|
| **B — Process-aware analytics** | «bottleneck detection по распределению времени пребывания в колонках» | Aging WIP signal: per-task age vs column percentile (P50/P85). Foundation for proper bottleneck detection in Phase 8. |
| **B — Process-aware analytics** | «cycle/lead time с percentile-разметкой» | Aging WIP uses column-level percentile thresholds; the math is identical to what Phase 8 will use for stuck-task alerts. |
| **B+ — Statistical forecasting** | «percentile-based alerts на застрявшие задачи» | Aging WIP is the *visual* form of this alert (board-wide indicator); Phase 8 adds the *aggregated* alert panel + endpoint. Phase 5 lays the data pipeline. |
| **B+ — Statistical forecasting** | (новое — implied by "Scrumban") Service Level Expectations | Adds `boards.sle_days` + `boards.sle_probability`; auto-compute from cycle time history; surfaces a probabilistic statement "85% of tasks finish in N days". |
| **Methodology fitness** | (vision claims «Scrumban-платформа») | Classes of Service (Anderson 2010): 4-value enum, expedite bypasses WIP, fixed_date has deadline warning, standard FIFO, intangible deprioritized. Pull system enforced (remove `force=true` bypass), explicit replenishment cadence. |

**What this phase does NOT close:** percentile alert panel + endpoint (Phase 8), calibration framework (Phase 8), per-CoS analytics breakdown (Phase 8), RF integrations (Phase 9), bottleneck detection per-column outlier analysis (Phase 8). Phase 5 is the data foundation; Phase 8 is the analytical depth.

---

## §2 What we're building (overview)

Five sub-features. Order: schema → backend services → frontend → e2e verification. Each sub-feature has its own commit.

### 2.1 Classes of Service (CoS) — Anderson 2010

Four-value enum on tasks: `expedite | fixed_date | standard | intangible`. Each class has policy rules:

| Class | Identifier in UI | Backend rule | Default |
|---|---|---|---|
| Expedite | red ⚡ badge, dropped first | Bypasses column WIP limit (only mechanism that can). | — |
| Fixed Date | calendar 📅 badge with target date | UI warns when `due_date - today < sle_days`; backend computes "should-start-by" date. | requires `due_date` |
| Standard | no badge | FIFO ordering within column by `created_at`. | system default |
| Intangible | minus 🔻 badge, muted color | Lowest sort priority; appears last in column. | — |

Replaces `priority` enum (`low|medium|high`) — those values are not Anderson CoS, they're a different mental model. **Migration handling:**
- `priority='high'` → `service_class='fixed_date'` (with `due_date = NULL` — needs admin attention later)
- `priority='medium'` → `service_class='standard'`
- `priority='low'` → `service_class='intangible'`

Cards in the same column sorted by: expedite (newest first) → fixed_date (nearest due_date first) → standard (FIFO by created_at) → intangible (FIFO by created_at).

### 2.2 Service Level Expectation (SLE) per board

Probabilistic statement: "85% of tasks finish in N days." Two board-level fields:
- `sle_days integer NULL` — when NULL, SLE is "not configured" (UI shows setup hint).
- `sle_probability decimal(3,2) DEFAULT 0.85` — typically 0.85, can be tweaked to 0.50, 0.70, 0.95.

**Auto-compute** endpoint: `POST /boards/:id/sle/recompute` (admin+). Reads last 90 days of closed tasks on this board, computes percentile of cycle time at `sle_probability`. Writes back to `sle_days`. UI button on board settings.

**Manual override:** admin can set `sle_days` to any value via PATCH endpoint.

**Surfacing:** board header shows badge "SLE: 85% за 8 дней" (admin sees ✏️ to edit). Drawer of a single task shows "Age: 5/8 days (62%)" relative to SLE.

### 2.3 Aging WIP visualization

Per task on the kanban view, compute **age in current column**:
- `age_in_column_days = (now - moved_into_current_column_at) / 86400`
- Source of truth: latest `task_events` row of type `task_moved` where `to_column_id = task.column_id`. Fallback to `task.created_at` if no move event.

Compare against board-level `sle_days`:
- 0–50% of SLE → no visual change
- 50–70% → soft yellow tint on card border
- 70–85% → orange border
- 85%+ → red border + ⚠️ icon in card corner

If `sle_days IS NULL` (not configured) → no aging visualization. Compute happens on the frontend (data already available).

### 2.4 Pull system enforcement

Currently `POST /boards/:id/tasks/:taskId/move` accepts `force: true` to bypass column WIP limit (any caller can override). Remove this — `force` becomes admin-only AND only with explicit reason field. Real bypass goes through CoS:

- Expedite tasks ALWAYS bypass WIP (Anderson rule)
- Any other class hitting WIP limit → 422 "WIP limit reached, task cannot be pulled"
- Admin override via `force=true` requires `force_reason` field — logged in `task_events.payload`

**No new endpoint** — modify existing move endpoint behavior + add `force_reason text` to body schema.

### 2.5 Replenishment cadence

Board-level fields:
- `last_replenishment_at timestamp NULL` — when the team last ran a replenishment meeting
- `replenishment_period_days integer DEFAULT 7` — cadence

UI: badge in board header
- "Next replenishment: in 3 days" (green/neutral when on-schedule)
- "Replenishment overdue by 2 days" (red when past expected period)
- Admin action button: "Mark replenishment as done" — bumps `last_replenishment_at = now`

This is intentionally **minimal** — replenishment is a meeting concept, not a transactional one. The UI just signals when the team should be planning. No "replenishment dialog" with task selection — that's normal create/move flow.

---

## §3 Schema changes

New migration file: `drizzle/migrations/00NN_phase5_scrumban_distinct.sql`. Generated via `bun run db:generate` after schema edits.

```diff
 // server/db/schema/tasks.ts
-export const taskPriority = pgEnum('task_priority', ['low', 'medium', 'high'])
+export const serviceClass = pgEnum('service_class', [
+  'expedite', 'fixed_date', 'standard', 'intangible',
+])

 export const tasks = pgTable('tasks', {
   ...
-  priority: taskPriority('priority').notNull().default('medium'),
+  serviceClass: serviceClass('service_class').notNull().default('standard'),
+  dueDate: timestamp('due_date', { withTimezone: true }),
+  expeditedAt: timestamp('expedited_at', { withTimezone: true }),
   ...
 })
```

```diff
 // server/db/schema/boards.ts
 export const boards = pgTable('boards', {
   ...
+  sleDays: integer('sle_days'),
+  sleProbability: decimal('sle_probability', { precision: 3, scale: 2 }).default('0.85'),
+  lastReplenishmentAt: timestamp('last_replenishment_at', { withTimezone: true }),
+  replenishmentPeriodDays: integer('replenishment_period_days').default(7),
   ...
 })
```

**Data migration:** existing `priority` values map to `service_class`:

```sql
ALTER TABLE tasks ADD COLUMN service_class service_class NOT NULL DEFAULT 'standard';
ALTER TABLE tasks ADD COLUMN due_date timestamp with time zone;
ALTER TABLE tasks ADD COLUMN expedited_at timestamp with time zone;

UPDATE tasks SET service_class = CASE
  WHEN priority = 'high'   THEN 'fixed_date'::service_class
  WHEN priority = 'medium' THEN 'standard'::service_class
  WHEN priority = 'low'    THEN 'intangible'::service_class
END;

ALTER TABLE tasks DROP COLUMN priority;
DROP TYPE task_priority;

ALTER TABLE boards ADD COLUMN sle_days integer;
ALTER TABLE boards ADD COLUMN sle_probability numeric(3,2) DEFAULT 0.85;
ALTER TABLE boards ADD COLUMN last_replenishment_at timestamp with time zone;
ALTER TABLE boards ADD COLUMN replenishment_period_days integer DEFAULT 7;
```

Index recommendation: `CREATE INDEX tasks_board_service_class_idx ON tasks (board_id, service_class)` — for per-CoS analytics later.

---

## §4 Backend services + endpoints

### 4.1 `services/tasks.service.ts` changes

- `createTask` accepts `serviceClass` + `dueDate` (optional). Validation: if `serviceClass='fixed_date'`, `dueDate` must be present and > now. If `serviceClass='expedite'`, set `expeditedAt = now`.
- `moveTask` WIP enforcement:
  ```ts
  if (task.serviceClass !== 'expedite' && !input.force) {
    const colTaskCount = await tx.select({ count: count() }).from(tasks)
      .where(and(eq(tasks.columnId, input.toColumnId), eq(tasks.workspaceId, ...)))
    if (column.wipLimit && colTaskCount[0].count >= column.wipLimit) {
      throw new ValidationError('Column WIP limit reached')
    }
  }
  ```
- `listTasksForBoard` returns tasks sorted by: `service_class ordinal asc, due_date asc nulls last, created_at asc` (so expedite first, then fixed_date by deadline, then standard FIFO, then intangible). Service class ordinal: expedite=1, fixed_date=2, standard=3, intangible=4.

### 4.2 `services/boards.service.ts` changes

- `createBoard` accepts optional `sleDays`, `sleProbability` (default 0.85), `replenishmentPeriodDays` (default 7).
- New: `computeSLE(boardId, probability)` — reads task_events for last 90 days where event_type='task_closed' joined with tasks on this board, computes per-task cycle time (`task_closed.createdAt - task_created.createdAt`), returns `percentile(cycle_times, probability)` in days.
- New: `recordReplenishment(boardId)` — sets `lastReplenishmentAt = now`. Admin+.

### 4.3 New endpoints

- `POST /api/workspaces/:id/boards/:boardId/sle/recompute` — runs `computeSLE`, writes back to `boards.sle_days`. Admin+.
- `PATCH /api/workspaces/:id/boards/:boardId` — already exists for renames, extend to accept `sleDays`, `sleProbability`, `replenishmentPeriodDays` fields.
- `POST /api/workspaces/:id/boards/:boardId/replenishment` — `recordReplenishment`. Admin+.

### 4.4 Modified endpoint signatures

- `POST /boards/:id/tasks` body: `priority` → `serviceClass` (+ optional `dueDate`).
- `PATCH /boards/:id/tasks/:taskId` body: same.
- `POST /boards/:id/tasks/:taskId/move` body: `force?: boolean` + `force_reason?: string`. Service throws if `force=true && !force_reason`.

### 4.5 Tests to add

- CoS migration: existing task with `priority='medium'` becomes `serviceClass='standard'` after migration (drizzle migration test or seed-based)
- Expedite task moves into WIP-full column → 200 (bypass)
- Standard task moves into WIP-full column → 422
- Force=true without reason → 400
- Force=true with reason → 200 and task_events.payload has `force_reason`
- recomputeSLE on board with 5+ closed tasks → returns reasonable percentile

Aim for 6 new test cases. Updates 124+2 (current Phase 4.5 tests) → 132 total.

---

## §5 Frontend components + pages

### 5.1 New shared types

- `shared/types/task.ts`: replace `priority: TaskPriority` with `serviceClass: ServiceClass`. Add `dueDate?: string | null`, `expeditedAt?: string | null`.
- `shared/types/domain.ts`: replace `TaskPriority` with `ServiceClass` enum.
- `shared/types/board.ts`: add `sleDays?: number | null`, `sleProbability?: number`, `lastReplenishmentAt?: string | null`, `replenishmentPeriodDays?: number`.

### 5.2 Updated components

- `TaskCreateModal` / `TaskDrawer`: replace `priority` USelect with `serviceClass` USelect (4 options) + conditional `dueDate` UDatePicker when class='fixed_date'.
- `TaskCard`: replace priority badge with service-class icon-badge (⚡ red, 📅 amber, no badge for standard, 🔻 muted for intangible). Card border tint per aging WIP.
- `BoardColumn`: cards already sorted by backend; no change needed.
- `BoardSubnav`: add SLE badge ("SLE: 85% за 8 дней"). Add replenishment cadence indicator.
- `BoardCreateModal`: optional fields for SLE + replenishment period (with defaults).

### 5.3 New components

- `app/components/board/SLESettings.vue`: modal/popover with manual override + "Recompute from history" button. Triggered from BoardSubnav SLE badge (admin+).
- `app/components/task/ServiceClassBadge.vue` → `<TaskServiceClassBadge>`: small badge with icon + color per class.
- `app/utils/aging-wip.ts`: pure function `getAgingTier(ageHours, sleDays) → 'fresh' | 'warning-50' | 'warning-70' | 'over-85'` returning Tailwind class names for card border.

### 5.4 New composables

- `useAgingWip(task, board)`: computes aging tier reactively. Reads `task.events` (latest `task_moved` to current column) or `task.createdAt`. Returns CSS class.

### 5.5 Page updates

- `app/pages/workspaces/[id]/boards/[boardId]/index.vue`: pass `board.sleDays` down to BoardColumn → TaskCard for aging visualization.

---

## §6 Order of implementation (commit plan)

Each commit is one logical chunk. Numbers match the commit suffix.

1. **`feat(scrumban): add service_class enum + SLE/replenishment columns + migration`** — schema + migration only. Tests skipped (no logic yet).
2. **`feat(scrumban): replace task.priority with service_class in backend`** — services/tasks.service.ts changes, endpoints body schema, regenerate types. Backend tests updated (priority → serviceClass everywhere).
3. **`feat(scrumban): wire serviceClass through frontend types + create/edit forms`** — shared/types changes, TaskCreateModal + TaskDrawer + TaskCard with new badge.
4. **`feat(scrumban): enforce column WIP, expedite bypass, force=true requires reason`** — moveTask service logic + new tests.
5. **`feat(scrumban): SLE recompute endpoint + board settings UI`** — sle/recompute endpoint, services/boards.service.ts.computeSLE, SLESettings.vue.
6. **`feat(scrumban): aging WIP visualization on cards`** — useAgingWip composable, TaskCard border tinting, BoardSubnav SLE badge.
7. **`feat(scrumban): replenishment cadence indicator + admin trigger`** — board PATCH for period setting, POST replenishment endpoint, BoardSubnav badge.
8. **`docs(scrumban): record Phase 5 closure + Phase 6 trigger`** — update relevant `0X-*.md` Target sections.
9. **`Merge branch 'feature/phase5-scrumban' into main`** — final merge.

Estimated effort: ~2 weeks per [`05-mvp-scope-and-roadmap.md`](../../05-mvp-scope-and-roadmap.md) Phase 5 estimate.

---

## §7 Definition of Done

### Per feature
- [ ] DB migration applies cleanly to a dev DB and reverses correctly (test with `db:generate && db:migrate`)
- [ ] Tests: at least 1 happy path + 1 error path per new service method
- [ ] RLS-guard test if the change touches tenant-scoped tables (it does — tasks, boards)
- [ ] Frontend manually verified in browser

### Phase 5 overall
- [ ] All 5 sub-features browser-tested end-to-end (CoS picker → DnD → aging visible → WIP enforcement → SLE setup → replenishment indicator)
- [ ] No regression: 126 existing tests still green; +6 new tests = 132+
- [ ] §1 vision-pillars check filled and honest
- [ ] Commits merge cleanly into main with `--no-ff`
- [ ] One screen-recorded demo of full flow for advisor review (optional but recommended)

---

## §8 Open questions / risks

1. **Migration on production data** — when we eventually deploy, the `priority → service_class` mapping is destructive. For Phase 5 (no production yet) this is fine; for Phase 10 (deploy) we need to either snapshot priority into a `legacy_priority` column or document the conversion clearly.
2. **Cycle time computation method** — currently `task_closed.createdAt - task_created.createdAt`. This is total lead time, not "cycle time" strictly (which usually excludes backlog). Phase 8 will refine to "from first move out of backlog to task_closed". Phase 5 uses the simpler version.
3. **Aging WIP performance** — computing age client-side per card is O(N) per render. With N=200 tasks it's fine; if N grows, move to backend pre-computed field. Defer until measured.
4. **Replenishment as state vs concept** — keeping it as a timestamp + cadence reminder, not a separate domain entity. If teams want "replenishment meeting notes" → Phase 7 comments table can hold those.
5. **Expedite WIP cap** — Anderson recommends expedite have its own cap (typically 1-3). Skipping for Phase 5; if tested teams report abuse, add `boards.expedite_wip_limit` in Phase 5.5.

---

## §9 What's NOT in this phase (deferred to Phase 8)

- `/api/.../boards/:id/alerts` endpoint with stuck-task list — Phase 8 (will reuse aging-WIP math).
- Per-CoS analytics breakdown (CFD with CoS layer, throughput by CoS) — Phase 8.
- Monte Carlo calibration framework — Phase 8 (this is the thesis-math chapter).
- Bottleneck detection per-column outlier analysis — Phase 8.
- Variant analysis on task_events — Phase 8.

Phase 5 = data foundation + visual indicators. Phase 8 = aggregation, alerting, validation framework.