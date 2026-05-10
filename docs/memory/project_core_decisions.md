---
name: Scrumban project core decisions (обновлено 2026-04-26)
description: Locked foundational decisions — scope, positioning, stack, timeline; стек обновлён после Nuxt monorepo pivot 2026-04-23 + Nuxt 4/UI v3 уточнения 2026-04-26
type: project
originSessionId: 4d07de0a-84f0-4563-b2b7-e26a2bcc8a82
---
Магистерский дипломный проект Scrumban-платформы. Решения зафиксированы в brainstorming 2026-04-18, стек обновлён 2026-04-23 (pivot Go → Nuxt monorepo) и 2026-04-26 (Nuxt 4, Nuxt UI v4, latest versions hard rule).

**Scope & timeline:**
- Production-ready продукт (не прототип).
- Solo разработчик.
- ~9 месяцев до защиты, ~3 месяца до предзащиты с рабочим MVP.

**Подход к разработке:** Backend сначала (железобетонно), frontend прикручиваем после готового API. Обоснование: API-контракт фундамент; вся сложная логика (auth, RLS, real-time, аналитика) на бэке; user сильный во фронте → быстро соберёт после.

**Позиционирование:**
- Scrumban-платформа для русскоязычных IT-команд.
- B (ядро): process-aware analytics — CFD, cycle time, throughput, bottleneck detection. «Inspired by process mining», не «process mining system».
- B+ (акцент): statistical forecasting — Monte Carlo прогноз спринтов (≥1000 симуляций), Little's Law WIP-рекомендации, percentile-based alerts.
- E (акцент): РФ-интеграции — 1С, Bitrix24, Yandex Workspace, GitFlic/GitVerse, Pachca/VK Teams.
- ML — только как research appendix в тексте диплома (XGBoost / лог. регрессия), НЕ product feature.

**ЦА:**
- Primary: Scrum Master / Agile Coach / Delivery Manager.
- Команды 30+ человек в русскоязычных IT-компаниях.

**Deployment:**
- Hybrid: SaaS-first, on-prem capable с первого дня (контейнеризация, S3-совместимый storage, никакого cloud-specific lock-in).
- MVP демо — Yandex Cloud VM (~1000 ₽/мес).

**Монетизация:**
- Open-core: Free / Pro / Enterprise.
- Биллинг НЕ в MVP (некому продавать пока).

**Стек (обновлён 2026-04-26):**
- **Структура:** Nuxt monorepo — `app/` (frontend) + `server/` (Nitro backend) в одном проекте. НЕ отдельные `backend/` + `frontend/` папки.
- **Frontend:** Nuxt 4 + Vue 3 + Pinia + TypeScript strict + Tailwind CSS 4 + Nuxt UI v4 (база) + Inspira UI (wow-эффекты) + vue-bits (анимации) + ECharts + vuedraggable + @tanstack/vue-query.
- **Backend (Nitro):** H3 router, Drizzle ORM + Drizzle Kit, nuxt-auth-utils + argon2id, pg-boss (Postgres-очередь), zod (валидация + источник OpenAPI), pino (structured logs).
- **БД:** PostgreSQL 16+ с Row-Level Security.
- **Контракт API:** code-first OpenAPI — zod-схемы → zod-to-openapi → openapi-typescript для frontend client. Все типы пересекающие границу — генерятся, не пишутся.
- **Тесты:** vitest + @nuxt/test-utils + @testcontainers/postgresql.
- **Real-time:** SSE через H3 createEventStream() + pg LISTEN/NOTIFY.
- **Infra:** Docker Compose, Caddy reverse-proxy, GitHub Actions CI/CD, Yandex Cloud SaaS / MinIO on-prem storage.

**Версионная политика:** всегда последние стабильные версии (см. `feedback_latest_stack_versions.md`). Никаких deprecated API, никаких legacy-версий.

**Что НЕ в MVP / не используем:**
- **Не Go** — убран 2026-04-23 (solo TS-dev не может быть автором, только ревьюером)
- **Не GraphQL** — REST + OpenAPI достаточно
- **Не Redis / Kafka / RabbitMQ** — pg-boss на Postgres
- **Не Kubernetes** — Docker Compose на VM
- **Не WebSocket** — SSE достаточно
- **Не SSR** — Nuxt в SPA-режиме (auth-gated продукт)
- **Не ORM с DSL** (Prisma) — Drizzle близок к SQL
- **Не микросервисы** — модульный монолит
- **Не ML в продукте** — только research extension
- **Не NextUI/HeroUI** — это для React, не для Vue
- **Не SSO в MVP**, **не биллинг в MVP**

**Как применять:** Все последующие обсуждения фич, архитектуры, UI должны соответствовать этим решениям. При отклонении — явно флажить.
