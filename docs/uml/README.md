# UML документация

Набор UML-диаграмм для магистерской дипломной работы по Scrumban-платформе. Каждая диаграмма — в отдельной подпапке, каждая содержит:

- `*.puml` — исходник PlantUML (single source of truth);
- `*.svg` — рендер для вставки в текст диплома (векторная графика, масштабируется без потери качества);
- `*.md` — текстовое описание диаграммы: актёры, прецеденты/сущности, пояснение ключевых решений — готово для копирования в главу диплома.

## Набор диаграмм

| # | Папка | Диаграмма | Назначение | Глава диплома |
|---|-------|-----------|------------|---------------|
| 1 | [`01-use-case/`](01-use-case/) | Use Case | Функциональные требования, актёры и прецеденты | Анализ требований |
| 2 | [`02-class/`](02-class/) | Class (domain) | Доменная модель, связи сущностей | Проектирование данных |
| 3 | [`03-er/`](03-er/) | ER | Физическая схема БД PostgreSQL | Проектирование БД |
| 4 | [`04-component/`](04-component/) | Component | Архитектура системы: Nuxt / Go / Postgres / Storage / Caddy | Архитектура |
| 5 | [`05-deployment/`](05-deployment/) | Deployment | Физическое развёртывание (SaaS + on-prem) | Развёртывание |
| 6 | [`06-sequence/`](06-sequence/) | Sequence (×3) | Ключевые сценарии: логин, создание задачи с SSE, Monte Carlo | Реализация |
| 7 | [`07-state/`](07-state/) | State Machine (×2) | Жизненный цикл Task и Sprint | Реализация |

См. [`theory.md`](theory.md) — краткий справочник по всем 14 типам UML-диаграмм (для главы «Анализ методологии моделирования» или «Обзор инструментов»).

## Инструмент — PlantUML

### Установка

**macOS (рекомендуется):**
```bash
brew install plantuml
```

После установки проверка:
```bash
plantuml -version
# PlantUML version 1.2024.xxx (...)
```

### IDE-preview (удобно для итеративной работы)

- **IntelliJ IDEA / WebStorm / GoLand:** установить плагин «PlantUML integration» → автоматически показывает preview при открытии `.puml` файла.
- **VS Code:** установить расширение «PlantUML» (jebbs.plantuml) → команда `Alt+D` показывает preview.

### Рендер из CLI

Из корня проекта:
```bash
# Одна диаграмма
plantuml -tsvg docs/uml/01-use-case/use-case.puml

# Все сразу
plantuml -tsvg -r docs/uml/**/*.puml

# PNG (для слайдов предзащиты, если нужны растровые)
plantuml -tpng docs/uml/01-use-case/use-case.puml
```

Файлы `.svg` / `.png` генерируются рядом с `.puml`. **В git коммитим и `.puml`, и `.svg`** — чтобы в репо была готовая версия для вставки в текст, и чтобы GitHub/GitLab рендерили preview.

### Альтернативы (на случай проблем)

- **Online:** [plantuml.com/plantuml](https://www.plantuml.com/plantuml/) — вставляешь .puml текст → получаешь рендер. Не требует установки.
- **Kroki.io** — аналогичный онлайн-сервис.

## Принципы работы с диаграммами

1. **Single source of truth — `.puml`.** Никогда не редактировать SVG/PNG напрямую; только через PlantUML.
2. **Одна диаграмма — одна мысль.** Не пытаться уместить всё; лучше несколько читаемых.
3. **Русские подписи в ключевых диаграммах** (для диплома), английские — там, где это идиоматично (коды, названия сущностей в class diagram).
4. **Согласованность:** актёры в use case ↔ роли в RBAC ↔ участники в sequence — одинаковые имена.
5. **Git-history:** каждая диаграмма — отдельный коммит (`docs(uml): add class diagram`), удобно для ревью.

## Связанные документы

- [`../superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`](../superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md) — master spec (актуальный)
- [`../archive/2026-04-18-scrumban-platform-design.md`](../archive/2026-04-18-scrumban-platform-design.md) — архивированный Go-spec, исторический референс для главы об эволюции архитектуры
- [`../06-system-architecture.md`](../06-system-architecture.md) — текстовое описание архитектуры (→ component, deployment)
- [`../07-domain-model.md`](../07-domain-model.md) — текстовое описание доменной модели (→ class, ER)
- [`../02-target-audience.md`](../02-target-audience.md) — описание актёров (→ use case)
- [`../11-non-functional.md`](../11-non-functional.md) — RBAC и роли (→ use case)
