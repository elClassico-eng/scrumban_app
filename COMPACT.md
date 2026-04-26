# COMPACT — состояние проекта

Этот файл поддерживается в актуальном состоянии. Если ты читаешь его после компакта контекста или новой сессии — здесь точка входа: что сделано, где остановились, куда двигаемся.

**Обновлён:** 2026-04-26.

---

## Моментальный снимок состояния

### Проект на этапе
**Pivot завершён, docs-update в процессе, готовимся к Phase 1 backend.**

Pivot: Go backend → Nuxt monorepo (Nitro). Все ключевые решения зафиксированы:
- Master spec: `docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`
- Стек: Nuxt 4 + Vue 3 + Tailwind 4 + Nuxt UI v3 + Nitro + Drizzle + pg-boss + zod + pino + PostgreSQL 16
- Версионная политика: всегда latest stable, strict TS, codegen на всех границах слоёв.

**Approach к реализации (зафиксирован 2026-04-26):**
- **Backend пишет Claude** с краткими code-comments об ответственностях (1-2 строки где non-obvious). User обучается через ревью реального кода.
- **Frontend пишем совместно** — Claude предлагает, user адаптирует.
- **Phase 0 pet-project пропущен** — обучение через реальный Scrumban-код, а не отдельный notes-api.

### Последнее выполненное действие
2 коммита в репо: `chore: project setup` и `docs: project documentation, UML diagrams, and Nuxt monorepo pivot`. Запущено выполнение docs-update плана.

### Следующий шаг
Доделать docs-update плана (привести existing docs в соответствие с pivot'ом), потом — brainstorm + spec + plan для Phase 1 backend (auth + workspaces foundation), потом — implementation.

---

## Что сделано (checklist)

### Этап 1 — Brainstorming & принятие решений
- ✅ Методология Scrumban изучена, конкуренты проанализированы.
- ✅ Позиционирование: B (process-aware analytics) + B+ (Monte Carlo / Little's Law) + E (РФ-интеграции).
- ✅ ML перемещён из product в research extension (диплом-глава).
- ✅ ЦА — Scrum Master в команде 30+.
- ✅ Deploy: hybrid SaaS-first + on-prem.
- ✅ Монетизация: Open-core (Free / Pro / Enterprise).

### Этап 2 — Документация проекта (14 файлов в `docs/`)
- ✅ Все `01-12-*.md` написаны.
- ✅ `README.md` — индекс.
- ✅ Master spec v1: `docs/superpowers/specs/2026-04-18-scrumban-platform-design.md` (Go).

### Этап 3 — UML диаграммы
- ✅ Use Case (1 общая + 5 per-role — задание научрука выполнено).
- ✅ Class (domain), ER (database), Component, Sequence (3), State Machine (2).
- ✅ Learning материалы (по 4 .puml + learning-guide.md в каждой подпапке).
- ⏸ Deployment диаграмма — пропущена по решению user.

### Этап 4 — Pivot Go → Nuxt monorepo (2026-04-23 → 2026-04-26)
- ✅ Brainstorming + spec: `2026-04-23-nuxt-monorepo-pivot.md`.
- ✅ План обновления docs: `2026-04-23-pivot-docs-update.md`.
- ✅ План Phase 0 (как референс, не исполняется): `2026-04-23-phase0-week1-nitro-starter.md`.
- ✅ Memory обновлена: `project_core_decisions.md` отражает Nuxt monorepo + Nitro.
- ✅ Новые feedback-файлы: `feedback_latest_stack_versions.md`, `feedback_implementation_division.md`.
- ✅ CLAUDE.md обновлён под Nuxt 4 + Nuxt UI v3.
- ✅ Pivot spec уточнён под Nuxt 4 + Nuxt UI v3 (после правки 2026-04-26).
- ✅ Roles guide расширен (роль ≠ должность; Viewer ≠ исполнитель и т.д.).
- ✅ README обновлён под актуальный стек.

### Этап 5 — Инфраструктура
- ✅ `.gitignore`, `.claude/settings.json`.
- ✅ CLAUDE.md, COMPACT.md.
- ✅ docs/memory/ синхронизирован с auto-memory.
- ✅ 2 git-коммита (project setup + docs).

### Этап 6 — Docs-update execution (текущее)
- 🔄 Task 1: COMPACT.md (этот файл — обновляется сейчас).
- ⏳ Task 2: rewrite `08-backend-design.md`.
- ⏳ Task 3-6: правки `06-system-architecture.md`, `12-deployment.md`, `11-non-functional.md`, `05-roadmap.md`, master spec.
- ⏳ Task 7-8: правки UML (component + sequence diagrams).
- ⏳ Task 9: удалить старый Go Phase 0 plan.

---

## Что в процессе / на паузе

- 🔄 **Docs-update execution** — выполняется сейчас.
- ⏸ **Deployment diagram** — скип по решению user.
- ⏸ **Phase 0 pet-project** — пропущен; план оставлен в репо как референс setup'а.

---

## Что дальше (по важности)

### Ближайший следующий шаг
Завершить docs-update план → начать Phase 1 backend.

### Phase 1 — MVP Foundation backend
По roadmap: auth + workspaces + базовая schema + OpenAPI-контракт.

Перед началом нужно:
1. Brainstorm Phase 1 scope (что входит в «foundation», что в Phase 2).
2. Spec Phase 1 backend (slack endpoints, schema, RLS).
3. Implementation plan с TDD-последовательностью.
4. Реализация (Claude — backend; user — frontend в Phase 2+).

### Долгосрочно (весь roadmap)
Из `docs/05-mvp-scope-and-roadmap.md`:
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
3. **`docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`** — актуальный master spec.
4. **`docs/05-mvp-scope-and-roadmap.md`** — фазы, DoD, критерии.
5. **`docs/06-system-architecture.md`** — архитектура текстом.
6. **`docs/superpowers/plans/2026-04-23-pivot-docs-update.md`** — план текущей docs-update работы.

---

## Контекст user

- **Даня** — магистрант ВолГУ, делает scrumban как дипломный проект, solo.
- **Frontend-сильный** (Nuxt/Vue/TS), backend пишет Claude.
- **Хочет понимать**, что Claude делает в backend — через краткие комментарии и объяснения, не через самостоятельное написание.
- **Делает senior-grade критику архитектуры** — ML был заменён на статистику не случайно.
- **Имеет PlantUML plugin в IDE** — SVG в `learning/` не генерируем.
- **Обращение на «ты»**, русский язык, коммиты на английском.

---

## Регулярные обновления

**Этот файл должен обновляться после каждого значимого куска работы.** Минимум:
- Пополнить список «Что сделано».
- Обновить «Что дальше».
- Обновить дату в заголовке.
