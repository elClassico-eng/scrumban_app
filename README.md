# Scrumban

Scrumban-платформа для русскоязычных IT-команд с углублённой аналитикой потока работ, Monte Carlo прогнозированием и Little's Law рекомендациями.

Магистерский дипломный проект.

## Документация

Вся проектная документация — в [`docs/`](docs/README.md).

### Thesis-разделы (для диплома)
- [01 — Vision & Goals](docs/01-vision-and-goals.md)
- [02 — Target Audience](docs/02-target-audience.md)
- [03 — Competitive Analysis](docs/03-competitive-analysis.md)
- [04 — Economic Rationale](docs/04-economic-rationale.md)
- [05 — MVP Scope & Roadmap](docs/05-mvp-scope-and-roadmap.md)

### Технические спецификации
- [06 — System Architecture](docs/06-system-architecture.md)
- [07 — Domain Model](docs/07-domain-model.md)
- [08 — Backend Design](docs/08-backend-design.md)
- [09 — Frontend Design](docs/09-frontend-design.md)
- [10 — Analytics Design](docs/10-analytics-design.md)
- [11 — Non-Functional](docs/11-non-functional.md)
- [12 — Deployment](docs/12-deployment.md)

### Master spec (актуальный)
- [`docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`](docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md) — Nuxt monorepo (Nitro backend)
- [`docs/superpowers/specs/2026-04-18-scrumban-platform-design.md`](docs/superpowers/specs/2026-04-18-scrumban-platform-design.md) — исходный (Go backend, заменён pivot'ом)

## Стек

**Структура:** Nuxt monorepo — `app/` (frontend) + `server/` (Nitro backend) в одном проекте.

- **Frontend:** Nuxt 4 (SPA) + Vue 3 + Pinia + TypeScript strict + Tailwind CSS 4 + Nuxt UI v4 + ECharts
- **Backend (Nitro):** H3 + Drizzle ORM + nuxt-auth-utils + pg-boss + zod + pino
- **БД:** PostgreSQL 16+ с Row-Level Security
- **Real-time:** SSE через H3 + pg LISTEN/NOTIFY
- **Контракт API:** code-first OpenAPI (zod → openapi-typescript)
- **Тесты:** vitest + @nuxt/test-utils + testcontainers/postgresql
- **Infra:** Docker Compose, Caddy, GitHub Actions, Yandex Cloud / MinIO

**Версионная политика:** всегда latest stable. Никаких deprecated API.

## Статус

- 2026-04-18: начало проекта, дизайн-фаза.
- 2026-04-23: pivot Go → Nuxt monorepo.
- 2026-04-26: уточнения (Nuxt 4, Nuxt UI v4, latest-versions hard rule).
- Следующий шаг — обновление документации под pivot, затем Phase 0 Week 1 (Nitro starter pet-project).
