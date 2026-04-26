# COMPACT — состояние проекта

Этот файл поддерживается в актуальном состоянии. Если ты читаешь его после компакта контекста или новой сессии — здесь точка входа: что сделано, где остановились, куда двигаемся.

**Обновлён:** 2026-04-20.

---

## Моментальный снимок состояния

### Проект на этапе
**Design & Documentation завершены. Реализация НЕ начата.** Начальный brainstorming полностью закрыт, вся документация проекта существует, UML-диаграммы нарисованы, implementation plan для Phase 0 Week 1 готов, но код НЕ написан.

### Последнее выполненное действие
Созданы учебные (`learning/`) папки для всех 6 UML диаграмм. Затем user попросил удалить все SVG и создать CLAUDE.md + COMPACT.md (этот файл).

### Следующий шаг (ожидаемый)
User сам читает документы, UML-диаграммы и их `learning-guide.md`, чтобы разобраться в концепциях. Когда будет готов — **начнём Phase 0 Week 1**: установка Go, первый pet-project на echo + in-memory CRUD (см. `docs/superpowers/plans/2026-04-18-phase0-week1-notes-api.md`).

---

## Что сделано (checklist)

### Этап 1 — Brainstorming & принятие решений
- ✅ Методология Scrumban изучена, конкуренты проанализированы.
- ✅ Зафиксировано позиционирование: B (process-aware analytics) + B+ (Monte Carlo / Little's Law) + E (РФ-интеграции).
- ✅ ML перемещён из product в research extension (диплом-глава).
- ✅ ЦА — Scrum Master в команде 30+.
- ✅ Deploy: hybrid SaaS-first + on-prem.
- ✅ Монетизация: Open-core (Free / Pro / Enterprise).
- ✅ Стек: Nuxt 3 SPA + Go backend + Postgres + Docker + Yandex Cloud.

### Этап 2 — Документация проекта (14 файлов в `docs/`)
- ✅ `01-vision-and-goals.md` — концепция, цели, научная новизна.
- ✅ `02-target-audience.md` — персоны, антипаттерны.
- ✅ `03-competitive-analysis.md` — Jira, ClickUp, Kaiten, YT, Weeek, YouGile.
- ✅ `04-economic-rationale.md` — рынок, unit economics, тарифы.
- ✅ `05-mvp-scope-and-roadmap.md` — MUST/SHOULD/LATER, 8 фаз, DoD.
- ✅ `06-system-architecture.md` — архитектура, потоки данных (dual-track).
- ✅ `07-domain-model.md` — сущности, схема БД.
- ✅ `08-backend-design.md` — Go-пакеты, прогрессивный подход.
- ✅ `09-frontend-design.md` — Nuxt SPA, Design Language, UI-библиотеки.
- ✅ `10-analytics-design.md` — формулы CFD / Monte Carlo / Little's Law.
- ✅ `11-non-functional.md` — auth, RBAC, RLS, observability.
- ✅ `12-deployment.md` — Docker Compose, CI/CD, среды.
- ✅ `README.md` — индекс.
- ✅ Master spec: `docs/superpowers/specs/2026-04-18-scrumban-platform-design.md`.

### Этап 3 — Implementation plan
- ✅ Phase 0 Week 1 (notes-api pet-project): `docs/superpowers/plans/2026-04-18-phase0-week1-notes-api.md`.

### Этап 4 — UML диаграммы
- ✅ **Use Case:** 1 общая (`use-case.puml`) + 5 per-role (`role-*.puml`) — **требование научрука выполнено**.
  - Сопутствующие: `use-case.md`, `roles-guide.md`.
- ✅ **Class (domain):** `domain-classes.puml` + `domain-classes.md`.
- ✅ **ER (database):** `database.puml` + `database.md`.
- ✅ **Component:** `components.puml` + `components.md`.
- ✅ **Sequence (3):** `login.puml`, `create-task-sse.puml`, `monte-carlo.puml` + `sequences.md`.
- ✅ **State Machine (2):** `task-lifecycle.puml`, `sprint-lifecycle.puml` + `states.md`.
- ⏸ **Deployment:** пропущено по решению user. Может быть добавлено позже.

### Этап 5 — Learning materials (для самостоятельного понимания user'ом)
- ✅ `docs/uml/theory.md` — справочник по 14 типам UML.
- ✅ `docs/uml/01-use-case/learning/` (4 .puml + learning-guide.md).
- ✅ `docs/uml/02-class/learning/` (4 .puml + learning-guide.md).
- ✅ `docs/uml/03-er/learning/` (4 .puml + learning-guide.md).
- ✅ `docs/uml/04-component/learning/` (4 .puml + learning-guide.md).
- ✅ `docs/uml/06-sequence/learning/` (4 .puml + learning-guide.md).
- ✅ `docs/uml/07-state/learning/` (4 .puml + learning-guide.md).

### Этап 6 — Инфраструктура работы
- ✅ `CLAUDE.md` создан в корне проекта.
- ✅ `COMPACT.md` создан (этот файл).
- ✅ `docs/memory/` с синхронизированным снапшотом memory files.
- ✅ Все SVG в `docs/uml/` удалены (user использует IDE preview для `.puml`).
- ✅ `.gitignore` содержит `.superpowers/` (скрыт brainstorm визуальный компаньон).

---

## Что в процессе / на паузе

- ⏸ **Deployment diagram** — скип по решению user. Если понадобится для кафедры — вернуться.
- ⏸ **Phase 0 Week 1 реализация** — план готов, user сам изучает Go и будет выполнять. Я помогаю по запросу.
- ⏸ **git commit всего** — user попросил сделать самому, был предложен формат коммитов.

---

## Что дальше (по важности)

### Ближайший следующий шаг
**Ждём, что user разберётся с UML и архитектурой.** Когда он задаст конкретный вопрос или скажет «начинаем реализацию» — двигаемся дальше.

### Потенциально следующее
1. **Старт Phase 0 Week 1** — установка Go, создание pet-project по плану.
2. **Фаза 0 Week 2+ planning** — Postgres + sqlc + goose миграции в notes-api.
3. **Фаза 1 MVP Foundation plan** — монорепо, OpenAPI-контракт, базовый auth и schema.
4. Если user попросит **дорисовать Deployment** — сделать в `docs/uml/05-deployment/`.
5. Если user попросит **обновить документы** под новое решение — обновить + sync memory.

### Долгосрочно (весь roadmap)
Из `docs/05-mvp-scope-and-roadmap.md`:
- Phase 0 (месяц 0): Go foundation via pet-project notes-api.
- Phase 1 (месяц 1): MVP Foundation — auth + workspaces.
- Phase 2 (месяц 2): Board & Tasks.
- Phase 3 (месяц 3): Sprints & Basic Analytics → **предзащита с рабочим демо**.
- Phase 4–5 (месяцы 4–6): B+ углубление + multi-tenancy hardening.
- Phase 6 (месяц 7): research-эксперимент + текст диплома.
- Phase 7 (месяцы 8–9): production polish + защита.

---

## Ключевые документы (читать в порядке приоритета)

1. **`CLAUDE.md`** — как работать, стек, принципы, что НЕ делать.
2. **`docs/memory/MEMORY.md`** — индекс накопленной памяти.
3. **`docs/superpowers/specs/2026-04-18-scrumban-platform-design.md`** — консолидированный master spec.
4. **`docs/05-mvp-scope-and-roadmap.md`** — фазы, DoD, критерии.
5. **`docs/06-system-architecture.md`** — архитектура текстом.
6. **`docs/superpowers/plans/2026-04-18-phase0-week1-notes-api.md`** — первый план реализации.

---

## Контекст user

- **Даня** — магистрант ВолГУ, делает scrumban как дипломный проект, solo.
- **Frontend-сильный**, Go будет учить с нуля.
- **Хочет понимать сам**, не чёрный ящик. Ценит объяснения терминов.
- **Делает senior-grade критику архитектуры** — ML был заменён на статистику не случайно.
- **Имеет PlantUML plugin в IDE** — SVG в `learning/` не генерируем.
- **Обращение на «ты»**, русский язык.

---

## Регулярные обновления

**Этот файл должен обновляться после каждого значимого куска работы.** Минимум:
- Пополнить список «Что сделано».
- Обновить «Что дальше».
- Обновить дату в заголовке.

Если работа идёт интенсивно (несколько сессий подряд) — обновлять в конце каждой сессии. Если длинная пауза — обновить перед паузой, чтобы в следующий раз быстро войти.
