# CLAUDE.md

Инструкция для Claude при работе в этом репозитории. Загружается автоматически в начале каждой сессии.

---

## О проекте

**Scrumban** — магистерский дипломный проект: платформа управления задачами для IT-команд. Гибрид методологий Scrum и Kanban с углублённой аналитикой потока работ (CFD, Monte Carlo прогнозирование, Little's Law рекомендации) и нативной интеграцией в РФ-экосистему (GitFlic, Pachca, Yandex Cloud, 1С).

Это не «ещё один таск-трекер», а **lightweight Scrumban-инструмент с обоснованной математикой в аналитике** для команд 30+ человек.

## Контекст разработчика (важно учитывать)

- **Роль:** solo full-stack (один человек делает всё).
- **Компетенции:** сильный frontend (Nuxt / Vue / TypeScript). Backend новый, но в TS-стеке (Nitro), не в чужом языке.
- **Обучение:** осваивает full-stack TS на pet-project (Phase 0). Важно понимать каждое решение, не черный ящик.
- **Сроки:** 9 месяцев до защиты, ~3 месяца до предзащиты с демо рабочего MVP.
- **Подход:** backend сначала (железобетонно), frontend прикручивается после готового API.

## Что ОБЯЗАТЕЛЬНО читать в начале сессии

1. **`docs/memory/MEMORY.md`** — индекс накопленных feedback/preferences/решений (синхронизированная копия).
2. **Отдельные файлы памяти в `docs/memory/`** — детали:
   - `user_critical_thinking.md` — user критичен к hype, ценит trade-off'ы.
   - `feedback_architectural_rigor.md` — делает senior-grade критику.
   - `feedback_teaching_calibration.md` — осваивает TS-backend; не презентовать senior-patterns как must-have.
   - `feedback_learning_pace.md` — хочет понимать сам, не чёрный ящик.
   - `feedback_claim_discipline.md` — язык должен соответствовать реализации.
   - `feedback_no_svg_in_learning.md` — SVG в `learning/` не генерировать.
   - `feedback_latest_stack_versions.md` — latest stable, strict TS, codegen везде; Nuxt 4 (НЕ 3), Nuxt UI v4 (НЕ NextUI).
   - `project_core_decisions.md` — зафиксированные scope/стек/монетизация (обновлено 2026-04-26).
   - `project_architectural_principles.md` — hard rules для кодовой базы.
   - `project_dual_track_approach.md` — Current/Target/Evolution формат.
3. **`COMPACT.md`** — текущий прогресс, где остановились.
4. **`docs/README.md`** — индекс всей документации.

Также auto-memory читается из `/Users/danya/.claude/projects/-Users-danya--------------------scrumban-app/memory/` — это оригинал, `docs/memory/` — синхронизированная копия для git.

## Принципы работы (выжимка из memory)

### Про ответы пользователю
1. **Progressive complexity.** Не презентовать senior-patterns как must-have. User учит Go. Начинать с простого, наращивать по мере нужды.
2. **Learning pace.** Объяснять термины при первом упоминании. Не давить темпом. Если user сказал «буду разбираться» — пауза на усвоение.
3. **Honesty over hype.** User режет маркетинговые абстракции. ML заменён на статистику не случайно — user раскритиковал. Ожидать такую же критику.
4. **Architectural rigor.** Любое замечание user по архитектуре принимать буквально, интегрировать, не защищать своё.
5. **Claim discipline.** Если в тексте «process mining system», а в коде одна формула — на защите вскроют. Используй «inspired by X approaches» там, где реализация легче.

### Про работу с документами
1. **Dual-track формат.** Каждый spec содержит: Current (что строим) / Target (куда эволюционируем) / Evolution (путь и триггеры).
2. **Русский язык** в документах и общении. Англ. техтермины — где идиоматично.
3. **Master spec:** `docs/superpowers/specs/2026-04-18-scrumban-platform-design.md`. Обновлять при мажорных изменениях.

### Про код (когда начнём писать)
1. **YAGNI ruthlessly.** Никаких features «на будущее», никаких fallback'ов для кейсов «на всякий случай».
2. **Минимум комментариев.** Комментируем только non-obvious WHY. Хорошие имена уже всё объясняют.
3. **Сначала тест, потом реализация.** TDD на критических путях.
4. **Error handling на границах.** Внутри — sentinel errors и `%w` обёртывание, мапинг в HTTP только в одном месте.

### Про действия (важно про blast radius)
- **НИКОГДА не коммитить без явного запроса.** Даже если user работал долго.
- **НИКОГДА не пушить.** Никогда.
- **Перед установкой пакетов** — подтверждение, даже если `brew install`.
- **Перед destructive операциями** (rm -rf, reset --hard, force push) — явное разрешение.
- **Перед модификацией настроек системы** (settings.json, git config) — подтверждение.

## Стек (зафиксирован 2026-04-26, не менять без обсуждения)

**Версионная политика:** всегда latest stable. См. `feedback_latest_stack_versions.md`.

**Структура:** Nuxt monorepo — `app/` (frontend) + `server/` (Nitro backend) в одном проекте. НЕ отдельные `backend/` + `frontend/` папки.

### Frontend
- **Nuxt 4** в SPA-режиме (`ssr: false`) + Vue 3 + Composition API + `<script setup lang="ts">`.
- **Pinia** — UI state.
- **TypeScript** strict (никаких `any` без обоснования).
- **Tailwind CSS 4** + **Nuxt UI v4** (база; **НЕ NextUI/HeroUI** — это для React) + **Inspira UI** (glassmorphism/gradient) + **vue-bits** (анимации).
- **@tanstack/vue-query** — серверный кэш.
- **ECharts** — графики (CFD, scatter, Monte Carlo).
- **vuedraggable** — drag-n-drop на доске.

### Backend (Nitro / Node.js)
- **Node.js 22 LTS+**.
- **Nitro + H3** — HTTP-сервер (встроен в Nuxt 4), файл-роутинг, SSE нативно.
- **Drizzle ORM + Drizzle Kit** — type-safe SQL, миграции через SQL-файлы.
- **nuxt-auth-utils** + argon2id — session cookies (HTTP-only).
- **pg-boss** — Postgres-очередь фоновых задач (без Redis).
- **zod** — валидация + источник OpenAPI-спеки (zod-to-openapi).
- **pino** — structured JSON логи.
- **vitest + @nuxt/test-utils + @testcontainers/postgresql** — тесты.

### Контракт API (codegen — обязательно)
- **Code-first OpenAPI:** zod-схемы → zod-to-openapi → `openapi/scrumban.yaml`.
- **TS-client для frontend:** openapi-typescript → `shared/types/api.d.ts`.
- Frontend никогда не импортирует из `server/` — только через сгенерированные типы.

### Инфраструктура
- **PostgreSQL 16+** с Row-Level Security.
- **Docker + docker-compose**.
- **Caddy** — reverse-proxy + TLS (Let's Encrypt).
- **GitHub Actions** (или GitFlic CI) — CI/CD.
- **Yandex Cloud** — SaaS хостинг; MinIO — on-prem storage.

### Что НЕ используем (явно)
- **Не Go** — убран 2026-04-23 (solo TS-dev).
- **Не GraphQL** — REST + OpenAPI достаточно.
- **Не Redis/Kafka/RabbitMQ** — pg-boss на Postgres.
- **Не Kubernetes в MVP** — Docker Compose на VM.
- **Не Next.js/React/NextUI/HeroUI** — Nuxt/Vue/Nuxt UI v4.
- **Не ORM с DSL (Prisma)** — Drizzle близок к SQL.
- **Не WebSocket** — SSE достаточно.
- **Не SSR** — SPA mode (auth-gated продукт).
- **Не микросервисы** — модульный монолит.
- **Не ML как product feature** — только research extension в дипломе.

## Структура репозитория

**Текущее (только документация):**
```
scrumban_app/
├── CLAUDE.md                    ← этот файл
├── COMPACT.md                   ← текущий прогресс
├── README.md                    ← overview для GitHub
├── docs/
│   ├── README.md                ← индекс всей документации
│   ├── memory/                  ← синхронизированный снапшот memory
│   ├── 01-vision-and-goals.md ... 12-deployment.md
│   ├── superpowers/
│   │   ├── specs/
│   │   │   ├── 2026-04-18-scrumban-platform-design.md
│   │   │   └── 2026-04-23-nuxt-monorepo-pivot.md       ← АКТУАЛЬНЫЙ master
│   │   └── plans/
│   │       ├── 2026-04-23-pivot-docs-update.md
│   │       └── 2026-04-23-phase0-week1-nitro-starter.md
│   └── uml/                     ← 6 типов диаграмм + learning/ подпапки
```

**С Phase 1 добавится Nuxt monorepo прямо в корень:**
```
scrumban_app/
├── nuxt.config.ts
├── app/                         ← Nuxt 4 frontend (pages, components)
├── server/                      ← Nitro backend
│   ├── api/                     ← HTTP handlers
│   ├── services/                ← бизнес-логика
│   ├── db/                      ← Drizzle schema + queries
│   ├── jobs/                    ← pg-boss workers
│   └── utils/
├── shared/                      ← общие типы (auto-import)
├── openapi/scrumban.yaml        ← сгенерированный контракт
├── drizzle/migrations/          ← SQL миграции
└── docs/                        ← всё что было раньше
```

## UML-диаграммы

Минимальный когерентный набор (каждая в своей папке `docs/uml/NN-*/`):

1. **use-case** — одна общая (per-role диаграммы заменены RBAC-матрицей в `11-non-functional.md`).
2. **class** — доменная модель.
3. **package** — модульная организация `app/` + `server/` + `shared/` (TBD, следующая задача после UML-cleanup).
4. **component** — архитектура системы (Current).
5. **sequence** (2 шт) — create-task-SSE, Monte Carlo (login убран как типовой).
6. **state machine** (2 шт) — task lifecycle, sprint lifecycle.

**ER** убрана — class diagram + Drizzle SQL-миграции покрывают то же. **Deployment** пропущена до Phase 5.

**В каждой папке `learning/` подпапка** с упрощёнными учебными версиями для самостоятельного понимания. У user PlantUML plugin в IDE — SVG НЕ генерируем, только `.puml` + `learning-guide.md`.

## Управление памятью

Когда пишешь новую memory:
1. **Обязательно** — в `/Users/danya/.claude/projects/-Users-danya--------------------scrumban-app/memory/` (auto-memory система).
2. **Обязательно** — скопировать в `docs/memory/` (чтобы жило в git и переносилось).
3. Обновить индекс в обоих `MEMORY.md`.

## Обновление COMPACT.md

После каждой значимой работы (новая секция дизайна, новый spec, диаграмма, plan) — обновить `COMPACT.md`, секции «Что сделано» и «Что дальше».

## Платформа и инструменты

- **macOS** Darwin (Mac).
- **IDE** у user: JetBrains (есть `.idea/`), возможно VS Code.
- **PlantUML plugin** в IDE есть — preview прямо на `.puml` файлах.
- **PlantUML** установлен через brew (`plantuml -tsvg` работает, но для learning/ не используем).
- **Homebrew** есть.
- **Java** есть (нужен для PlantUML).
- **Node.js** есть (для Nuxt).
- **Go** НЕ нужен (отказались 2026-04-23).
- **Docker** пока не проверен (у user есть «базовое понимание»).

## Когда ответ длинный или требует много тулов

- Используй TaskCreate для трекинга, особенно когда 3+ задач.
- Параллелизуй независимые tool calls.
- Давай коротки промежуточные updates перед тулами ("сейчас проверю X").
- Не генерируй SVG автоматически; user использует IDE preview.

## Кто я, кто user

User = Даня Черкесов, магистрант ВолГУ. Email artemovaulia391@gmail.com.

Обращаться на «ты», в дружелюбном но профессиональном тоне. Русский язык.

---

**Последнее обновление:** 2026-04-26 (Nuxt 4 + Nuxt UI v4 + latest-stack rule зафиксированы).
