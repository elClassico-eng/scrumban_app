# Takt («Такт»)

A lightweight Scrumban platform for Russian-speaking IT teams, with rigorous
flow analytics and probabilistic forecasting. Built as a master's thesis at
Volgograd State University.

The product blends Kanban (board, columns, WIP limits, classes of service,
SLE-driven aging) with Scrum (sprints, ceremonies, multi-assignee tasks,
burndown) and adds an analytics layer that most trackers leave out:
cumulative flow, cycle-time percentiles, network-planning forecasts
(CPM + data-driven PERT + Monte Carlo over the dependency network),
Little's-Law-based WIP recommendations, forecast calibration against
actual outcomes, and flow-aware notifications.

---

## Status

| Phase | Scope | Status |
|---|---|---|
| 1 – 3 | Auth, workspaces, boards, columns, tasks, sprints, real-time, analytics | ✅ Done |
| 4 – 4.5 | Full Nuxt SPA, UX polish | ✅ Done |
| 5 | Scrumban-distinct features: classes of service, SLE, aging WIP, pull enforcement, replenishment cadence | ✅ Done |
| 6 / 6.7 | Hierarchy (subtasks, dependencies, checklists), multi-view, identity, editorial design system | ✅ Done |
| 7 | Collaboration (comments + mentions, notifications, activity log), flow-aware alerts (SLE breach, replenishment overdue, sprint forecast drop), sprint backend depth (story points, capacity, burndown), sprints + Kanban page redesign | ✅ Done |
| 8 | Network-planning core (CPM, data-driven PERT, Monte Carlo over the dependency network), forecast journal + calibration («прогноз vs факт»), math legibility in UI, public docs site (methodology / math / project, KaTeX) | ✅ Done |
| 8.5 | Sprint ceremonies & simulation: creation wizard with probabilistic forecast, what-if scenario simulator, lifecycle event trail, close gates with carry-over decisions, immutable sprint reports (CSV/JSON), retro with executable action items, daily digest, activity feed, reports hub, analytics redesign | ✅ Done |
| 10 | Production deployment: Docker + Caddy on Yandex Cloud, CI push-to-deploy, auth hardening (email verification, password reset, invitations) | ✅ Live |
| 9, 11 – 12 | RU integrations (GitFlic, Pachca), identity polish, empirical study | ⏳ Planned |

Current branch: 326 tests passing, 37 SQL migrations, 124 backend
endpoints, 20 schema files. Multi-tenancy enforced via PostgreSQL
Row-Level Security.

---

## Stack

Single Nuxt 4 monorepo: `app/` (frontend SPA) + `server/` (Nitro backend) +
`shared/types/` (cross-app types).

**Frontend**

- Nuxt 4 in SPA mode (`ssr: false`) — auth-gated product
- Vue 3 + Composition API + `<script setup lang="ts">`
- TypeScript strict
- Nuxt UI v4 (built on Reka UI) + Tailwind CSS 4
- Pinia (UI state) + `@tanstack/vue-query` (server state)
- ECharts for analytics (CFD, scatter, Monte Carlo histogram, network graph)
- Nuxt Content + KaTeX — public documentation (methodology, math, project)
- vuedraggable for drag-and-drop

**Backend (Nitro)**

- Node.js 22 LTS
- Nitro + H3 — HTTP server, file-routing, native SSE
- Drizzle ORM + Drizzle Kit — type-safe SQL, hand-rolled SQL migrations for RLS
- `nuxt-auth-utils` + argon2id — session cookies (HTTP-only)
- Nitro experimental tasks — cron-scheduled flow-aware alerts
- zod — request validation
- pino — structured JSON logs

**Infrastructure**

- PostgreSQL 16 with Row-Level Security
- Docker + docker-compose
- Caddy — reverse proxy + automatic TLS via Let's Encrypt
- Yandex Cloud — production hosting target

**Testing**

- vitest + `@nuxt/test-utils` + `@testcontainers/postgresql`
- Each tenant-scoped feature has an RLS-leakage test

---

## Local development

Requirements: Node.js 22+, Bun, Docker Desktop.

```bash
# 1. install dependencies
bun install

# 2. start local PostgreSQL (port 5433 to avoid clashing with system PG)
docker compose -f docker-compose.dev.yml up -d

# 3. apply migrations
bun run db:migrate

# 4. run dev server (http://localhost:3000)
bun run dev
```

Useful scripts:

```bash
bun run typecheck    # nuxt typecheck
bun run lint         # eslint
bun run test         # vitest run
bun run db:generate  # generate a new migration after schema edits
bun run db:studio    # Drizzle Studio at http://localhost:4983
```

---

## Production deployment

The repository ships a production-ready Docker setup.

```bash
# on the production VM (Ubuntu 24.04 + Docker)
git clone https://github.com/<owner>/scrumban_app.git
cd scrumban_app
cp .env.prod.example .env
# fill in DOMAIN, LETSENCRYPT_EMAIL, POSTGRES_PASSWORD, NUXT_SESSION_PASSWORD
docker compose -f docker-compose.prod.yml up -d --build
```

Three services come up: `db` (Postgres 16 with the RLS init script applied
on first boot), `app` (multi-stage build of the Nuxt monorepo; runs Drizzle
migrations on container start, then the Nitro server), and `caddy` (reverse
proxy that obtains a Let's Encrypt certificate for the configured domain
and forwards traffic to the app).

Point an `A` record for the domain at the VM's public IPv4 and Caddy will
provision TLS automatically on first request.

---

## Project layout

```
scrumban_app/
├── app/                          ← Nuxt 4 SPA frontend
│   ├── components/               ← board, sprint, task, analytics, notification…
│   ├── composables/api/          ← vue-query wrappers around backend endpoints
│   ├── pages/                    ← file-routed pages
│   ├── stores/                   ← Pinia: auth, workspace, board, ui
│   └── utils/                    ← shared helpers (rbac, format, humanize)
├── server/                       ← Nitro backend
│   ├── api/                      ← HTTP handlers (file routing)
│   ├── services/                 ← business logic, transactional units (28 files)
│   ├── db/schema/                ← Drizzle schema (20 files)
│   ├── tasks/                    ← Nitro scheduled tasks (flow-aware alerts, daily forecast snapshots)
│   └── utils/                    ← auth, db (RLS helpers), errors, events, network-planning math
├── shared/types/                 ← types shared by app and server
├── content/docs/                 ← public docs site content (Nuxt Content, KaTeX)
├── drizzle/migrations/           ← SQL migrations (37 files)
├── db/init/                      ← PostgreSQL initdb scripts
├── caddy/Caddyfile               ← production reverse proxy
├── Dockerfile                    ← multi-stage production image
├── docker-compose.dev.yml        ← local PostgreSQL only
├── docker-compose.prod.yml       ← app + db + caddy
└── tests/                        ← vitest e2e tests
```

---

## Architecture highlights

- **Two-role PostgreSQL** — `scrumban` runtime role has `NOBYPASSRLS`, so
  RLS policies actually enforce tenant isolation in dev and prod alike.
  Migration scripts run under a privileged role.
- **Tenant context via session GUCs** — every request sets
  `app.workspace_id` (and `app.user_id` for cross-workspace data such as
  notifications) before any tenant-scoped query. The `withTenant` /
  `withUser` helpers are the only sanctioned entry points.
- **Append-only event logs** — `task_events` records every meaningful task
  state change and feeds the audit timeline, Cumulative Flow, cycle-time
  analytics, and Monte Carlo input; `sprint_events` does the same for the
  sprint lifecycle (start, date changes with mandatory reason, close with
  carry-over decisions) and feeds immutable materialized sprint reports.
- **Forecast calibration** — `forecast_snapshots` captures daily and
  lifecycle-anchored forecasts, so the analytics page can honestly show
  how past predictions compared to actual outcomes.
- **Optimistic UI with toast-undo** — task moves, reassignments, and
  service-class changes apply locally first and commit after a 5-second
  defer window during which the user can undo without an extra dialog.
- **Server-Sent Events** — board events fan out via an in-process bus; a
  user-scoped channel delivers notifications across workspaces in a
  single subscription. Postgres `LISTEN/NOTIFY` is the planned upgrade
  for multi-replica deployments.

---

## Author

Daniil Cherkesov — master's student, Volgograd State University.
Contact: daniilerkesov122@gmail.com

---

## License

Source code released under the MIT License (see `LICENSE`).
The accompanying thesis text and design documents are not part of this
repository.
