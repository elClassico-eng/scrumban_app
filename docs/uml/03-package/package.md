# Package Diagram — модульная организация

**Файл:** [`package.puml`](package.puml)

## Что показывает диаграмма

Package diagram отвечает на вопрос «**из каких модулей собран проект и как они импортируют друг друга**». Это вид на код-базу, не на доменные сущности и не на runtime.

Три родственные диаграммы покрывают разные срезы:

| Срез | Диаграмма | Файл |
|------|-----------|------|
| **Доменная модель** (что за «вещи» в системе) | Class | [`../02-class/domain-classes.puml`](../02-class/domain-classes.puml) |
| **Архитектура реализации** (как организован код) | **Package (этот файл)** | `package.puml` |
| **Runtime-архитектура** (что крутится в проде) | Component | [`../04-component/components.puml`](../04-component/components.puml) |

Полное текстовое описание структуры backend'а с эволюцией по фазам — в [`../../08-backend-design.md`](../../08-backend-design.md). Здесь — короткая выжимка под диаграмму.

## Текущие пакеты (Phase 1-3 MVP)

Все пакеты на диаграмме существуют физически в репозитории — это сверено через `ls server/`, `ls server/api/` и т. д. на момент создания файла.

### Frontend
- **`app/`** — Nuxt 4 frontend в SPA-режиме. На Phase 1-3 реально содержит только `app.vue` и `pages/index.vue` (skeleton). Полноценные `components/`, `composables/`, `stores/` — Phase 4.

### Shared types
- **`shared/types/`** — общие TS-типы, авто-импортируемые Nuxt'ом. На Phase 1-3 это только `auth.d.ts` (расширение `nuxt-auth-utils` для типизации сессии). `api.d.ts` помечен как `<<future>>` — он появится, когда подключим codegen из OpenAPI.

### Server tier (модульный монолит)
- **`server/api/`** — H3 file-routing handlers. ~44 файла, иерархия `auth/`, `workspaces/[id]/{boards,members}/...`, плюс `healthz.get.ts`. Каждый файл — один HTTP-эндпоинт.
- **`server/services/`** — pure-TS бизнес-логика, 8 файлов: `tasks`, `sprints`, `analytics`, `boards`, `columns`, `workspaces`, `workspace-members`, `users`. Сервис принимает уже-аутентифицированный контекст и возвращает данные либо бросает `DomainError`.
- **`server/db/schema/`** — Drizzle table-builders, 5 файлов под 9 таблиц + `index.ts` для барреля. Истина для типов БД — здесь, истина для DDL — в `drizzle/migrations/`.
- **`server/utils/`** — кроссрезные хелперы: `auth.ts` (обёртки над `nuxt-auth-utils`), `db.ts` (helper `withTenant` для RLS), `errors.ts` (5 sentinel-классов: `NotFoundError`, `ForbiddenError`, …), `events.ts` (in-process `EventEmitter` для SSE), `rbac.ts` (матрица 5 ролей × действий).

### Persistence DDL
- **`drizzle/migrations/`** — 7 SQL-миграций (`0000..0006`). Источник правды для DDL и RLS-политик. Коммитятся в git, генерируются `drizzle-kit` из изменений в `server/db/schema/`.

### Тесты
- **`tests/`** — vitest + `@testcontainers/postgresql`. 11 e2e-файлов (по одному на ресурс), один RLS-isolation тест (`rls.integration.test.ts`), один тест шины событий, плюс `helpers/`.

### Внешние зависимости
- **`nuxt 4 + h3`** — фреймворк (frontend и backend в одном артефакте).
- **`drizzle-orm + drizzle-kit`** — ORM и тулинг миграций.
- **`nuxt-auth-utils`** — session cookies + scrypt-хеширование паролей.
- **`zod`** — валидация request body (DTO).
- **`vitest + @testcontainers/postgresql`** — тестовый стек.
- **`pino`** — установлен в `package.json`, но в Current не подключён, помечен `<<future>>`.

## Acyclic dependency claim — почему это «модульный монолит»

На диаграмме все стрелки идут **сверху вниз**, циклов нет:

```
app/  →  shared/types    (только типы)

server/api  →  server/services  →  server/db/schema
              ↓
            server/utils

tests/  →  всё остальное (но не наоборот)
```

Что это значит на практике:

1. **Сервис никогда не импортирует обработчик.** Бизнес-логика не зависит от способа доставки запроса. Тот же `tasks.service.ts` можно дёрнуть из cron-job'а или фонового воркера — код сервиса не изменится.
2. **Schema никогда не зависит от services.** Drizzle-схема — это «данные», она знает только про колонки и связи, не про use cases. Это позволяет генерировать типы без подтягивания всей бизнес-логики.
3. **`shared/` ни на что не ссылается** из `server/` или `app/`. Это «нулевой слой» — типы, которые видны и фронту, и бэку.
4. **Тесты зависят от всего, но ничто не зависит от тестов.** Граф направлен.

Защита диплома: «У нас не микросервисы, но границы между слоями — настоящие, а не на словах. Они проверяются импортами в TypeScript-компиляторе. Любая попытка завести цикл (например, импортировать handler из service) сломает сборку».

В Target будет добавлен ESLint-rule `no-restricted-imports` или `eslint-plugin-boundaries` для авто-проверки в CI. На Phase 1-3 контроль ручной — через диаграмму и code review.

## Стратегия тестов

`tests/` сидит снаружи `server/` и `app/`, импортирует их как чёрные ящики. Тесты поднимают реальный Postgres через `testcontainers` (никаких моков БД), что и даёт RLS-isolation и lifecycle тесты, которые ловят реальные баги (а не вымышленные).

Подробнее — в [`../../08-backend-design.md#testing-strategy`](../../08-backend-design.md) и [`../../11-non-functional.md`](../../11-non-functional.md) (Quality Attributes → Testability).

## Target пакеты — что появится и при каких триггерах

Диаграмма намеренно **не рисует Target-пакеты как ghost-компоненты в основном теле**. Вместо этого внизу — note `N1` со списком и измеримыми триггерами (это требование по claim discipline: рисовать только то, что реализовано).

| Пакет | Назначение | Триггер появления |
|-------|-----------|-------------------|
| `server/middleware/` | Извлечь auth/tenant/rbac guards из обработчиков в общий middleware-чейн | ≥ 30 endpoint'ов с одинаковым guard-блоком |
| `server/jobs/` | pg-boss workers для фоновых задач | Первый async job: уведомления (email/webhook), aggregate refresh, Monte Carlo precompute |
| `server/db/queries/` | Выделенный query-слой поверх Drizzle | Дедуп одного и того же SQL'а в ≥ 3 сервисах |
| `openapi/scrumban.yaml` | Сгенерированный OpenAPI-контракт | Подключение фронтенда — ≥ 5 вызовов к API из `app/` |
| `shared/types/api.d.ts` | TS-клиент сгенерированный из OpenAPI | Тот же триггер, что у `openapi/` |
| `app/components/`, `app/composables/`, `app/stores/` | Полноценный фронтенд Phase 4 | Phase 4 (после 3 месяцев предзащиты) |

Полная Current/Target/Evolution карта backend'а — в [`../../08-backend-design.md`](../../08-backend-design.md). Frontend — в [`../../09-frontend-design.md`](../../09-frontend-design.md).

## Связанные документы

- [`../02-class/domain-classes.puml`](../02-class/domain-classes.puml) — доменная модель (классы и связи).
- [`../04-component/components.puml`](../04-component/components.puml) — runtime-архитектура (Nuxt + Postgres + Caddy).
- [`../../06-system-architecture.md`](../../06-system-architecture.md) — текстовое описание архитектуры.
- [`../../08-backend-design.md`](../../08-backend-design.md) — структура `server/` подробно (Current + Target + Evolution).
- [`../../09-frontend-design.md`](../../09-frontend-design.md) — структура `app/` подробно (Phase 4 Target).
- [`learning/learning-guide.md`](learning/learning-guide.md) — учебный разбор Package diagram нотации.
