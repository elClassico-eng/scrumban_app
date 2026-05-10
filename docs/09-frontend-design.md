# 09 — Frontend Design

Документ описывает frontend-слой приложения. На момент Phase 1-3 frontend существует только как skeleton: backend полностью реализован (см. [`08-backend-design.md`](08-backend-design.md)), но реальных вызовов API из `app/` ещё нет. Дизайн-язык, страницы, компоненты, composables и stores — это Phase 4 work, описаны в Target-секциях.

## Подход

### Current

В корне репозитория — Nuxt 4 monorepo (одна `package.json`, единый процесс). SPA-режим (`ssr: false`) в [`nuxt.config.ts`](../nuxt.config.ts), потому что продукт за аутентификацией и SEO не требуется.

Установлено и используется:
- [`nuxt`](../package.json) `^4.4.2` — фреймворк.
- [`@nuxt/ui`](../package.json) `^4.7.0` — компонентная база (Nuxt UI v4).

Файловая структура `app/` (всё остальное — Phase 4):
- [`app/app.vue`](../app/app.vue) — `<UApp><NuxtPage /></UApp>`, только wrapper.
- [`app/pages/index.vue`](../app/pages/index.vue) — stub-страница «Phase 1 — MVP Foundation. Skeleton is up.».

Не существует:
- `app/components/`, `app/composables/`, `app/stores/`, `app/lib/`, `app/assets/css/` — папки не созданы.
- API-клиента (ручного или сгенерированного) — нет.
- `tailwind.config.ts` / `tailwind.config.js` — нет (Tailwind 4 zero-config через Nuxt UI v4).

В `package.json` отсутствуют (проверено `grep`):
- `@tanstack/vue-query`, `pinia`
- `vuedraggable`, `echarts`
- `inspira-ui`, `vue-bits`
- `vee-validate`
- `@nuxt/icon`, `@nuxt/google-fonts`
- `@vueuse/core`

Backend (`server/`) реализован: handlers, services, миграции, SSE — см. [`08-backend-design.md`](08-backend-design.md). Frontend будет потреблять его как готовый Nitro-API в том же процессе.

### Target: Phase 4 frontend implementation

> **Триггер старта:** docs/code sync (план `2026-05-10-docs-code-sync.md`) завершён → стартует Phase 4 как следующая фаза. Внутренние подсекции (стек, дизайн-язык, страницы, компоненты, composables) активируются по roadmap-порядку — см. ниже.

Дальше идут проектные решения, которые на момент Phase 1-3 не реализованы, но зафиксированы как ориентир для Phase 4. Источник — собранные референсы и архитектурный спек ([`docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`](superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md)).

### Target: подход (Nuxt 4 SPA + Pinia + Tanstack Query + ECharts)

Frontend на Nuxt 4 в SPA-режиме (не SSR). Backend и frontend живут в одном Nitro-процессе (monorepo): server-routes Nitro обслуживают `/api/*`, SPA build — статические assets. Прокси-слой не нужен — `app/` напрямую обращается к `/api/*` того же origin.

Визуальная концепция — современный dark-first продуктовый UI с акцентными градиентами, glassmorphism-карточками и богатой data-визуализацией. Эстетика inspired by Linear / Vercel Dashboard / Aceternity-style.

> **Триггер ввода стека:** старт Phase 4 — установка зависимостей (`pinia`, `@tanstack/vue-query`, `@vueuse/core`) и каркас auth flow (см. roadmap, шаг 1).

### Target: Design Language

Ключевые принципы (собраны из референсов):

1. **Dark theme primary.** Основной фон — глубокий нейтральный (#0a0a0b / #0d0d10). Светлая тема — опциональна позже.
2. **Accent glow.** Один-два акцентных цвета (например, emerald + violet) используются для подсветки активных элементов, кнопок, важных метрик. Эффект ambient light.
3. **Glassmorphism для карточек.** Полупрозрачные surfaces с backdrop-blur для dashboards, task cards, navigation. Обводка `rgba(255,255,255,0.08)`.
4. **Gradient surfaces.** Мягкие радиальные градиенты в hero-секциях (login, welcome, upgrade CTA). От акцентного к прозрачному.
5. **Moderate rounding.** `rounded-xl` (12px) для карточек, `rounded-lg` (8px) для кнопок, `rounded-2xl` (16px) для крупных контейнеров.
6. **Generous spacing.** 16–24px padding внутри карточек, 24–32px gaps в сетках.
7. **Typography hierarchy.** Три уровня + monospace для чисел. Weighted headings (500–700), читаемые body (400).
8. **Metric cards.** Крупное число → мелкая метка «vs last period» → разноцветный тренд (↑/↓ + %).
9. **Pill labels.** Priority/status как pill'ы с цветным dot'ом (`• Medium`, `• High`).
10. **Avatars + progress bars.** На task-cards: аватары ответственных + progress indicator (например, story points done/total) + due date + comments count.

> **Триггер активации:** работа над dashboard / board view (roadmap, шаги 2 и 4).

### Target: цветовая палитра

```
background:    #0a0a0b   (primary page)
surface:       #111114   (cards)
surface-raised:#17171c   (elevated)
border:        rgba(255,255,255,0.08)

text-primary:  #f4f4f5
text-secondary:#a1a1aa
text-muted:    #71717a

accent-primary:  emerald-500 (#10b981)  — success, done, positive trends
accent-secondary:violet-500 (#8b5cf6)   — highlights, Pro features
accent-warn:     amber-500 (#f59e0b)    — medium priority, warnings
accent-danger:   rose-500 (#f43f5e)     — errors, overdue, high priority
```

Всё — через CSS custom properties, чтобы переключение темы было возможно без рефакторинга.

### Target: типографика

- **Heading:** Inter или Manrope, weight 600–700.
- **Body:** Inter / system font stack, weight 400–500.
- **Monospace (числа, коды):** JetBrains Mono или IBM Plex Mono.
- Подключение через `@nuxt/google-fonts` (модуль будет добавлен на шаге 1 roadmap).

### Target: движения и анимация

- **Micro-interactions:** кнопки, hover-эффекты, drag feedback. 150–250ms ease-out.
- **Page transitions:** мягкий fade 200ms.
- **Chart draw-in:** ECharts native анимации, ~400ms.
- **Glow / spotlight effects** на hero и важных метриках (через Inspira UI или собственный CSS).
- **Никакой избыточности** — анимации не ради анимаций.

### Target: стек UI-библиотек (трёхслойная стратегия)

Слой 1 — База: **`@nuxt/ui`** (Nuxt UI v4, уже установлен). Reka UI под капотом (headless, доступные примитивы) + Tailwind CSS 4. Используется для: Button, Input, Textarea, Select, Modal, Drawer, Dropdown, Table, Tooltip, Toast, Tabs, Avatar, Command palette, Pagination, Breadcrumbs, Badge. Production-ready, accessible из коробки, отличная Nuxt-интеграция, активно развивается.

Слой 2 — Визуальные акценты: **`inspira-ui`** (нативный Vue-порт aceternity-style компонентов; в `package.json` пока нет, добавится на шаге 2 roadmap). Используется для: hero-градиенты, background beams, meteor effects, spotlight cards, glass cards, animated borders, aurora backgrounds, 3D-card hover, infinite moving cards. Именно эта библиотека даёт эстетику референсов; нативно Vue 3, не надо адаптировать React.

Слой 3 — Дополнительные анимации: **`vue-bits`** (Vue-порт reactbits; добавится по мере необходимости). Используется для: text animations (scramble, typewriter), particle backgrounds, gradient text, animated counters. Узкоспециализированные «wow»-эффекты для landing, login, upgrade-CTA — не для основного UI.

Слой 4 — Кастомный Tailwind. Для всего специфического:
- Доска Scrumban с drag-n-drop (структура колонок с Inspira glass-effect).
- Custom chart wrappers вокруг ECharts.
- Собственные layout-паттерны.

### Target: финальный стек

- **Nuxt 4** + **Vue 3** (Composition API + `<script setup>`) — установлено.
- **TypeScript** strict — настроен Nuxt-ом.
- **`@nuxt/ui`** v4 — установлено.
- **Pinia** — UI state, auth, текущий контекст. Будет добавлен.
- **`@tanstack/vue-query`** — серверный кэш и синхронизация. Будет добавлен.
- **`inspira-ui`** — визуальные акценты, glassmorphism, градиенты. Будет добавлен.
- **`vue-bits`** — дополнительные анимации. Будет добавлен.
- **Tailwind CSS 4** — стили (через Nuxt UI v4, без отдельного config-файла).
- **`@nuxt/google-fonts`** — Inter + JetBrains Mono. Будет добавлен.
- **`@nuxt/icon`** — иконки (Lucide, Heroicons collections). Будет добавлен.
- **ECharts** (Apache) — графики (CFD, scatter, throughput). Будет добавлен.
- **`vuedraggable`** — drag-n-drop на доске. Будет добавлен.
- **`zod`** + **`vee-validate`** — валидация форм. `zod` уже на бэке, `vee-validate` будет добавлен.
- **`@vueuse/core`** — утилиты (`useEventSource`, `useStorage`, `useDebounceFn` и т.п.). Будет добавлен.

### Target: референсы вдохновения

Пользовательские референсы показывают направление:

1. **Taskplus** (dashboard + kanban, dark) — точная референс-эстетика нашего dashboard'а. Иконки-меню, stats cards с +X vs last month, task cards с priority pills, avatars, progress bars.
2. **Quantix** (crypto dashboard со starfield + purple glow) — вдохновение для welcome/hero секций, analytics-страниц.
3. **OnlyPipe / Get Started with Us** (sign-up с градиентным side-panel) — шаблон для login / register / invitation-accept страниц: split-layout, градиент на левой панели со step-индикаторами, форма справа.
4. **Salesforce Customer Info** (цветные accent-cards на dark) — вдохновение для сравнения спринтов, контраст карточек.
5. **TransGlobal** (heatmap + map + orange accent) — inspo для cycle time scatter + heatmap узких мест.
6. **Your Education** (светлая тема, pastel cards) — опциональная светлая тема (позже).
7. **Dallo Glassmorphism** — техника для product-level cards и overlay-панелей.

### Target: структура проекта

Monorepo Nuxt 4 — `app/` + `server/` + `shared/` в одном корне (см. [`06-system-architecture.md`](06-system-architecture.md) для общей схемы):

```
scrumban_app/
├── app/                            # Nuxt 4 frontend
│   ├── app.vue                     # сейчас — только <UApp><NuxtPage /></UApp>
│   ├── pages/                      # auto-routing
│   │   ├── index.vue               # сейчас — stub
│   │   ├── auth/
│   │   │   ├── login.vue           # split-layout, градиент слева
│   │   │   └── register.vue        # 3-step onboarding
│   │   ├── invite/[token].vue
│   │   └── workspaces/
│   │       └── [wsId]/
│   │           ├── index.vue                    # workspace home
│   │           ├── boards/[boardId].vue         # kanban-доска
│   │           ├── backlog.vue
│   │           ├── sprints.vue
│   │           ├── analytics.vue                # CFD, scatter, Monte Carlo
│   │           └── settings/
│   │               ├── general.vue
│   │               └── members.vue
│   ├── components/
│   │   ├── board/                  # Board.vue, Column.vue, TaskCard.vue, WIPIndicator.vue
│   │   ├── task/                   # TaskDetailPanel.vue, CommentList.vue, TaskHistory.vue
│   │   ├── analytics/              # CFDChart.vue, ScatterChart.vue, ThroughputChart.vue, MonteCarloCard.vue, BottleneckHeatmap.vue
│   │   ├── dashboard/              # StatsCard.vue, GlassCard.vue, GradientHero.vue
│   │   ├── layout/                 # AppSidebar.vue, AppHeader.vue, Breadcrumbs.vue
│   │   └── ui/                     # кастомные расширения Nuxt UI v4
│   ├── composables/                # useWorkspace, useBoard, useEventSource, useAuth, useAnalyticsCopy
│   ├── stores/                     # Pinia: auth.ts, workspace.ts, board.ts
│   ├── lib/                        # api-client (codegen-output), analytics-copy.ts, utils
│   └── assets/css/                 # main.css (Tailwind entry + CSS vars), animations.css
├── server/                         # Nitro backend — см. 08-backend-design.md
└── shared/types/                   # общие типы (Nuxt auto-import), включая api.d.ts (codegen)
```

На момент Phase 1-3 в `app/` существует только `app.vue` (wrapper) и `pages/index.vue` (stub). Все остальные элементы — Phase 4 work.

### Target: ключевые страницы — дизайн-заметки

> **Триггер активации:** соответствующий шаг roadmap (login/register на шаге 1, board на шаге 2, analytics на шаге 4).

Login / Register:
- Split-layout 50/50.
- Левая часть — Inspira UI **aurora background** или **background beams** с логотипом и слоганом.
- Правая часть — форма на тёмном фоне.
- Кнопки OAuth (Yandex, GitFlic) сверху формы, разделитель «Or», классическая email/password.
- На register — step-indicator (1/2/3: account → workspace → profile).

Dashboard (главный):
- Верх: breadcrumbs + приветствие «Welcome back, {name}».
- Ряд 4 StatsCard: Total Projects / Total Tasks / In Review / Completed, с `+X vs last week`.
- Сетка 2 колонки:
  - Слева: «Today's Tasks» таблица с фильтром/поиском.
  - Справа: «Performance» — bar chart (throughput по дням недели) с метрикой `86% +15% vs last week`.
- Ниже: «List Projects» — таблица проектов с progress bars.

Board (kanban):
- Sidebar — AppSidebar с навигацией (проект / бэклог / спринты / аналитика).
- Breadcrumbs сверху: Project > Finance Dashboard.
- Tabs: Kanban / List / Timeline / Table.
- Колонки: glassmorphism-surfaces с заголовком «To Do», меню `⋮`.
- Task-cards:
  - Priority pill сверху (`• Medium` / `• High`), рядом context pill (`Saas`).
  - Title (18–20px, semibold).
  - Row: comments count, attachments count, due date.
  - Progress bar (строка микро-индикаторов story points done/total).
  - Avatars ответственных справа.
- WIP-индикатор в заголовке колонки: `3/5` → переходит в алерт-цвет при превышении.

Analytics:
- Hero-строка с Monte Carlo прогнозом: большая pill `78% probability of on-time delivery`, P50/P85/P95 детали.
- 2×2 сетка графиков:
  - CFD (stacked area)
  - Throughput (bar)
  - Cycle time scatter (с линиями p50/p85/p95)
  - Bottleneck heatmap
- Под каждым графиком — текст-интерпретация в стиле «10% задач в Review дольше 4 дней → посмотри блокеры».

Task detail (side drawer):
- Открывается справа overlay над доской.
- Заголовок (editable), short_id, priority pill, type badge.
- Tabs: Details / Comments / Activity / Attachments.
- Правая колонка меты: Assignee (avatar + name), Reporter, Story points, Sprint, Created, Updated.
- Сущности — см. [`07-domain-model.md`](07-domain-model.md) (комментарии и attachments сейчас Target).

Settings / Members:
- Таблица членов с ролями (pill dropdown).
- Invite button → модалка с email + role selector.
- 5 ролей — см. [`docs/uml/01-use-case/roles-guide.md`](uml/01-use-case/roles-guide.md) и [`11-non-functional.md`](11-non-functional.md).

### Target: данные — vue-query + API-клиент

> **Триггер активации:** шаг 2 roadmap (Board view) — первая страница, которой нужен серверный кэш и оптимистичные мутации.

Подход: `@tanstack/vue-query` кэширует серверное состояние, Pinia — только UI-state и короткоживущие данные. API-клиент сгенерирован из OpenAPI-спеки (см. [`08-backend-design.md`](08-backend-design.md) → Target → API contract codegen).

```typescript
// composables/useTasks.ts
export function useTasks(boardId: string) {
  return useQuery({
    queryKey: ['tasks', boardId],
    queryFn: () => api.tasks.list(boardId),
    staleTime: 30_000,
  })
}
```

Мутации с оптимистичным обновлением:
```typescript
const { mutate: moveTask } = useMutation({
  mutationFn: api.tasks.move,
  onMutate: async (variables) => {
    await queryClient.cancelQueries(['tasks', boardId])
    const prev = queryClient.getQueryData(['tasks', boardId])
    queryClient.setQueryData(['tasks', boardId], applyMove(prev, variables))
    return { prev }
  },
  onError: (_, __, ctx) => {
    queryClient.setQueryData(['tasks', boardId], ctx.prev)
  },
  onSettled: () => queryClient.invalidateQueries(['tasks', boardId]),
})
```

### Target: real-time — SSE

Backend SSE-эндпоинт уже готов (см. [`08-backend-design.md`](08-backend-design.md) и [`06-system-architecture.md`](06-system-architecture.md) → in-process event bus). Composable будет потреблять его через `useEventSource` из `@vueuse/core`:

```typescript
// composables/useBoardStream.ts
export function useBoardStream(boardId: Ref<string>) {
  const queryClient = useQueryClient()
  const url = computed(() => `/api/v1/boards/${boardId.value}/stream`)
  const { data } = useEventSource(url, ['task.moved', 'task.created'])

  watch(data, (event) => {
    if (!event) return
    queryClient.invalidateQueries({ queryKey: ['tasks', boardId.value] })
  })
}
```

### Target: UX-переводы цифр в действия

Каждый числовой результат сопровождается интерпретацией:

| Сырое | Что видит пользователь |
|-------|------------------------|
| `p95 cycle time = 4.2d` | «10% задач в Review висят дольше 4 дней — посмотри, нет ли блокеров» |
| `WIP optimum = 5` | «По Little's Law (throughput 10/нед × cycle 3.5д) оптимум WIP = 5. Текущий — 8. Возможно, избыточно» |
| `MC probability = 78%` | «С высокой вероятностью спринт будет закрыт в срок. Риск — 22%.» |
| `N < 30` | «Недостаточно данных для перцентилей. Нужно минимум 30 закрытых задач; сейчас — {n}.» |

Тексты в `app/lib/analytics-copy.ts` — легко менять, переводить.

### Target: условия отображения аналитики

- Если задач `< 30` → не показываем перцентили; placeholder с приглашением.
- Если спринтов `< 3` → Monte Carlo недоступен.
- Если событий `< 7 дней` → CFD placeholder «подожди неделю работы».

### Target: формы и валидация

- `vee-validate` + `zod` (типизированные схемы; zod-схемы переиспользуются с бэка через `shared/`).
- Ошибки API отображаются полем-специфично через маппинг кодов.
- Inline-валидация при blur.

### Target: иконки

- `@nuxt/icon` + Lucide collection — основной набор.
- Heroicons outline — как запасной.
- Собственные SVG только для брендовых элементов (лого).

### Target: accessibility

- Nuxt UI v4 (Reka UI под капотом) обеспечивает a11y по умолчанию.
- WCAG AA для контраста (основные тексты на dark background — уже соответствуют).
- Focus-ring включён.
- Keyboard navigation проверяется на основных флоу (login, task create, board drag — позже через accessible DnD).
- Подробнее — см. [`11-non-functional.md`](11-non-functional.md).

### Target: Phase 4 implementation roadmap

> **Триггер старта:** этот план (docs/code sync) завершён → переход к Phase 4 без долга в документации.

Порядок реализации (по убыванию защитной ценности):

1. **Auth flow** — pages: `/auth/login`, `/auth/register`. Composable `useAuth()` поверх nuxt-auth-utils. Pinia auth-store.
2. **Workspace + Board view** — `/workspaces/[wsId]/boards/[boardId]`. Drag-n-drop задач (vuedraggable), real-time SSE-updates (`useEventSource()` composable), WIP-индикаторы.
3. **Task detail panel** — sidebar / modal с описанием, assignees, priority, state. Без комментариев и attachments (они Target в [`07-domain-model.md`](07-domain-model.md)).
4. **Analytics dashboard** — `/workspaces/[wsId]/analytics`. CFD chart (ECharts), throughput, Monte Carlo card, cycle-time scatter, Little's Law рекомендации.
5. **Sprint planning** — backlog view, drag в активный спринт, start/close sprint controls.
6. **Settings + Members** — workspace settings, RBAC management UI (5 ролей, см. [`docs/uml/01-use-case/roles-guide.md`](uml/01-use-case/roles-guide.md)).

Параллельно (когда дойдём до пункта 1):
- Подключить `@tanstack/vue-query`, `pinia`, `vuedraggable`, `echarts`, `vee-validate`, `@nuxt/icon`, `@nuxt/google-fonts`, `@vueuse/core`.
- Подключить `inspira-ui` и `vue-bits` для glassmorphism / hero-сцен.
- Настроить CSS palette + Tailwind theme, если нужны кастомизации поверх Nuxt UI v4.
- Codegen pipeline (см. [`08-backend-design.md`](08-backend-design.md) → Target → API contract codegen) — триггер активной работы над frontend.

## Связанные документы
- [`06-system-architecture.md`](06-system-architecture.md) — backend-контрагент, SSE / event-bus
- [`07-domain-model.md`](07-domain-model.md) — сущности, которые потребляет frontend
- [`08-backend-design.md`](08-backend-design.md) — API, codegen pipeline
- [`10-analytics-design.md`](10-analytics-design.md) — что визуализируем
- [`11-non-functional.md`](11-non-functional.md) — accessibility, RBAC
- [`docs/uml/01-use-case/roles-guide.md`](uml/01-use-case/roles-guide.md) — 5 ролей для Settings/Members UI
