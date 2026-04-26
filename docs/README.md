# Документация проекта Scrumban

Набор документов для магистерской дипломной работы и практической реализации Scrumban-платформы. Все документы оформлены в формате **Current / Target / Evolution**:

- **Current** — что реализуется сейчас (MVP за ~3 месяца до предзащиты).
- **Target** — production-grade целевое состояние к защите (~9 месяцев).
- **Evolution** — как движемся из Current в Target, триггеры и порядок работ.

## Thesis-разделы (материал для текста диплома)

| Номер | Документ | Содержание |
|-------|----------|------------|
| 01 | [Vision & Goals](01-vision-and-goals.md) | Концепция, цели проекта, научная новизна, позиционирование |
| 02 | [Target Audience](02-target-audience.md) | Целевая аудитория, персоны, проблемы пользователей |
| 03 | [Competitive Analysis](03-competitive-analysis.md) | Анализ аналогов: отечественных и зарубежных, ниша |
| 04 | [Economic Rationale](04-economic-rationale.md) | Практическая значимость, рынок, монетизация, unit economics |
| 05 | [MVP Scope & Roadmap](05-mvp-scope-and-roadmap.md) | Scope MVP, фазы разработки, критерии готовности |

## Technical specs (архитектура и реализация)

| Номер | Документ | Содержание |
|-------|----------|------------|
| 06 | [System Architecture](06-system-architecture.md) | Высокоуровневая архитектура, компоненты, потоки данных |
| 07 | [Domain Model](07-domain-model.md) | Сущности, связи, схема БД |
| 08 | [Backend Design](08-backend-design.md) | Nitro backend: структура, паттерны, тесты |
| 09 | [Frontend Design](09-frontend-design.md) | Nuxt 4 SPA: структура, стор, маршрутизация |
| 10 | [Analytics Design](10-analytics-design.md) | CFD, cycle time, Monte Carlo, Little's Law |
| 11 | [Non-Functional](11-non-functional.md) | Auth, RBAC, multi-tenancy (RLS), observability |
| 12 | [Deployment](12-deployment.md) | Docker, CI/CD, мониторинг, бэкапы, on-prem |

## Master spec

- **Актуальный:** [`superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`](superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md) — Nuxt monorepo с Nitro backend (после pivot'а с Go).
- **Исходный (заменён):** [`superpowers/specs/2026-04-18-scrumban-platform-design.md`](superpowers/specs/2026-04-18-scrumban-platform-design.md) — оригинальный дизайн с Go backend.

## Статус документов

- 2026-04-18: документы созданы как результат сессии проектирования (Go backend).
- 2026-04-23: pivot на Nuxt monorepo (Nitro backend); основной master spec заменён.
- 2026-04-26: уточнения стека (Nuxt 4, Nuxt UI v3, latest stable hard rule); подход к разработке (Claude пишет backend, frontend совместно).
- Все изменения отражаются в git-истории.

## Ключевые принципы работы с документацией

1. **Dual-track (Current/Target/Evolution).** Не фиксируем одно состояние; каждое решение показывает, где мы сейчас и куда движемся.
2. **Claim discipline.** Формулировки соответствуют реализации. Используется «inspired by process mining approaches», а не «process mining system», пока не реализованы discovery-алгоритмы и conformance checking.
3. **Honest trade-offs.** Для каждого решения указан компромисс: почему именно так, что могли бы сделать иначе, при каких условиях.
4. **Progressive complexity.** Не вводим новую концепцию раньше, чем она нужна. Target-архитектура — ориентир, не требование «сделать сразу».