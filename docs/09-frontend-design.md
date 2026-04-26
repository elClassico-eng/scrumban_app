# 09 — Frontend Design

## Подход

Frontend на Nuxt 3 в **SPA-режиме** (не SSR). Продукт за аутентификацией, SEO не требуется, SSR дал бы оверхед без пользы. Server routes Nuxt остаются — используются как BFF (proxy-агрегация к Go API).

Визуальная концепция — **современный dark-first продуктовый UI** с акцентными градиентами, glassmorphism-карточками и богатой data-визуализацией. Эстетика inspired by Linear / Vercel Dashboard / Aceternity-style.

## Design Language

### Ключевые принципы (собраны из референсов)

1. **Dark theme primary.** Основной фон — глубокий нейтральный (#0a0a0b / #0d0d10). Светлая тема — опциональна в LATER.
2. **Accent glow.** Один-два акцентных цвета (например, emerald + violet) используются для подсветки активных элементов, кнопок, важных метрик. Эффект ambient light.
3. **Glassmorphism для карточек.** Полупрозрачные surfaces с backdrop-blur для dashboards, task cards, navigation. Обводка `rgba(255,255,255,0.08)`.
4. **Gradient surfaces.** Мягкие радиальные градиенты в hero-секциях (login, welcome, upgrade CTA). От акцентного к прозрачному.
5. **Moderate rounding.** `rounded-xl` (12px) для карточек, `rounded-lg` (8px) для кнопок, `rounded-2xl` (16px) для крупных контейнеров.
6. **Generous spacing.** 16–24px padding внутри карточек, 24–32px gaps в сетках.
7. **Typography hierarchy.** Три уровня + monospace для чисел. Weighted headings (500–700), читаемые body (400).
8. **Metric cards.** Крупное число → мелкая метка «vs last period» → разноцветный тренд (↑/↓ + %).
9. **Pill labels.** Priority/status как pill'ы с цветным dot'ом (`• Medium`, `• High`).
10. **Avatars + progress bars.** На task-cards: аватары ответственных + progress indicator (например, story points done/total) + due date + comments count.

### Цветовая палитра (tentative)

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

Всё — через CSS custom properties, доступно переключение темы в будущем.

### Типографика

- **Heading:** Inter или Manrope, weight 600–700.
- **Body:** Inter / system font stack, weight 400–500.
- **Monospace (числа, коды):** JetBrains Mono или IBM Plex Mono.
- Подключение через `@nuxt/google-fonts`.

### Движения и анимация

- **Micro-interactions:** кнопки, hover-эффекты, drag feedback. 150–250ms ease-out.
- **Page transitions:** мягкий fade 200ms.
- **Chart draw-in:** ECharts native анимации, ~400ms.
- **Glow / spotlight effects** на hero и важных метриках (через Inspira UI или собственный CSS).
- **Никакой избыточности** — анимации не ради анимаций.

## Стек UI-библиотек — трёхслойная стратегия

### Слой 1 — База (Nuxt UI v3)
**`@nuxt/ui`** — официальная библиотека Nuxt. Reka UI под капотом (headless, доступные примитивы) + Tailwind.

Используется для: Button, Input, Textarea, Select, Modal, Drawer, Dropdown, Table, Tooltip, Toast, Tabs, Avatar, Command palette, Pagination, Breadcrumbs, Badge.

**Почему:** production-ready, accessible из коробки, отличная Nuxt-интеграция, встроенная темизация через Tailwind-конфиг, активно развивается.

### Слой 2 — Визуальные акценты (Inspira UI)
**`inspira-ui`** — нативный Vue-порт aceternity-style компонентов.

Используется для: hero-градиенты, background beams, meteor effects, spotlight cards, glass cards, animated borders, aurora backgrounds, 3D-card hover, infinite moving cards.

**Почему:** именно эта библиотека даёт эстетику референсов (glassmorphism, gradient glow, animated ambient backgrounds). В отличие от magicui/aceternity — нативно Vue 3, не надо адаптировать React.

### Слой 3 — Дополнительные анимации (vue-bits)
**`vue-bits`** — Vue-порт reactbits.

Используется для: text animations (scramble, typewriter), particle backgrounds, gradient text, animated counters (для чисел на dashboard cards).

**Почему:** узкоспециализированные «wow»-эффекты для landing, login, upgrade-CTA. Не для основного UI.

### Слой 4 — Кастомный Tailwind
Для всего специфического:
- Доска Scrumban с drag-n-drop (структура колонок с Inspira glass-effect).
- Custom chart wrappers вокруг ECharts.
- Собственные layout-паттерны.

## Стек (финальный)

- **Nuxt 3** + **Vue 3** (Composition API + `<script setup>`)
- **TypeScript** strict
- **Pinia** — UI state, auth, текущий контекст
- **@tanstack/vue-query** — серверный кэш и синхронизация
- **@nuxt/ui** — основная компонентная база
- **inspira-ui** — визуальные акценты, glassmorphism, градиенты
- **vue-bits** — дополнительные анимации
- **Tailwind CSS** — стили
- **@nuxt/google-fonts** — Inter + JetBrains Mono
- **@nuxt/icon** — иконки (Lucide, Heroicons collections)
- **ECharts** (Apache) — графики (CFD, scatter, throughput)
- **vuedraggable@next** — drag-n-drop на доске
- **zod** + **vee-validate** — валидация форм
- **VueUse** — утилиты

## Референсы вдохновения

Пользовательские референсы показывают направление:

1. **Taskplus** (dashboard + kanban, dark) — точная референс-эстетика нашего dashboard'а. Иконки-меню, stats cards с +X vs last month, task cards с priority pills, avatars, progress bars.
2. **Quantix** (crypto dashboard с starfield + purple glow) — вдохновение для welcome/hero секций, analytics-страниц.
3. **OnlyPipe / Get Started with Us** (sign-up с градиентным side-panel) — шаблон для login / register / invitation-accept страниц: split-layout, градиент на левой панели со step-индикаторами, форма справа.
4. **Salesforce Customer Info** (цветные accent-cards на dark) — вдохновение для сравнения спринтов, контраст карточек.
5. **TransGlobal** (heatmap + map + orange accent) — inspо для cycle time scatter + heatmap узких мест.
6. **Your Education** (светлая тема, pastel cards) — опциональная светлая тема (LATER).
7. **Dallo Glassmorphism** — техника для product-level cards и overlay-панелей.

## Структура проекта

```
frontend/
├── pages/                          # файловый роутинг Nuxt
│   ├── login.vue                   # split-layout, градиент слева
│   ├── register.vue                # 3-step onboarding, градиент слева
│   ├── invite/[token].vue
│   ├── index.vue                   # user dashboard (после логина)
│   ├── [workspace]/
│   │   ├── index.vue              # workspace home
│   │   ├── projects/
│   │   │   └── [projectId]/
│   │   │       ├── board.vue       # главная kanban-доска
│   │   │       ├── backlog.vue
│   │   │       ├── sprints.vue
│   │   │       └── analytics.vue   # CFD, scatter, Monte Carlo
│   │   └── settings/
│   │       ├── general.vue
│   │       ├── members.vue
│   │       └── billing.vue         # LATER
├── components/
│   ├── board/
│   │   ├── Board.vue
│   │   ├── Column.vue              # glassmorphism surface
│   │   ├── TaskCard.vue            # priority pill, avatars, progress
│   │   └── WIPIndicator.vue        # визуальный алерт при превышении
│   ├── task/
│   │   ├── TaskDetailPanel.vue     # side drawer
│   │   ├── CommentList.vue
│   │   └── TaskHistory.vue
│   ├── analytics/
│   │   ├── CFDChart.vue            # ECharts stacked area
│   │   ├── ScatterChart.vue        # cycle time percentiles
│   │   ├── ThroughputChart.vue
│   │   ├── MonteCarloCard.vue      # probability + CI
│   │   └── BottleneckHeatmap.vue
│   ├── dashboard/
│   │   ├── StatsCard.vue           # big number + trend pill
│   │   ├── GlassCard.vue           # обёртка glassmorphism
│   │   └── GradientHero.vue        # inspira-ui aurora background
│   ├── layout/
│   │   ├── AppSidebar.vue
│   │   ├── AppHeader.vue
│   │   └── Breadcrumbs.vue
│   └── ui/                         # кастомные расширения Nuxt UI
├── composables/
│   ├── useWorkspace.ts
│   ├── useBoard.ts
│   ├── useSSE.ts
│   ├── useAuth.ts
│   └── useAnalyticsCopy.ts         # переводы метрик в текст-действие
├── stores/
│   ├── auth.ts
│   ├── workspace.ts
│   └── board.ts
├── lib/
│   ├── api/                        # Target: kubb-generated client
│   ├── api-client.ts               # Current: ручной
│   ├── analytics-copy.ts           # тексты для UX-переводов
│   └── utils/
├── server/api/                     # BFF endpoints (если нужно)
├── assets/
│   ├── css/
│   │   ├── main.css                # Tailwind entry + CSS vars
│   │   └── animations.css
│   └── fonts/
├── nuxt.config.ts                  # ssr: false
├── tailwind.config.ts
└── package.json
```

## Ключевые страницы — дизайн-заметки

### Login / Register
- Split-layout: 50/50.
- Левая часть — Inspira UI **aurora background** или **background beams** с логотипом и слоганом.
- Правая часть — форма на тёмном фоне.
- Кнопки OAuth (Yandex, GitFlic) сверху формы, разделитель «Or», классическая email/password.
- На register — step-indicator (1/2/3: account → workspace → profile).

### Dashboard (главный)
- Верх: breadcrumbs + приветствие «Welcome back, {name}».
- Ряд 4 StatsCard: Total Projects / Total Tasks / In Review / Completed, с `+X vs last week`.
- Сетка 2 колонки:
  - Слева: «Today's Tasks» таблица с фильтром/поиском.
  - Справа: «Performance» — bar chart (throughput по дням недели) с метрикой `86% +15% vs last week`.
- Ниже: «List Projects» — таблица проектов с progress bars.

### Board (kanban)
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

### Analytics
- Hero-строка с Monte Carlo prognozом: большая pilа `78% probability of on-time delivery`, P50/P85/P95 детали.
- 2×2 сетка графиков:
  - CFD (stacked area)
  - Throughput (bar)
  - Cycle time scatter (с линиями p50/p85/p95)
  - Bottleneck heatmap
- Под каждым графиком — текст-интерпретация в стиле «10% задач в Review дольше 4 дней → посмотри блокеры».

### Task detail (side drawer)
- Открывается справа overlay над доской.
- Заголовок (editable), short_id, priority pill, type badge.
- Tabs: Details / Comments / Activity / Attachments.
- Правая колонка меты: Assignee (avatar + name), Reporter, Story points, Sprint, Created, Updated.

### Settings / Members
- Таблица членов с ролями (пilл dropdown).
- Invite button → модалка с email + role selector.

## Данные: vue-query + API-клиент

Подход: **vue-query кэширует серверное состояние, Pinia — только UI-state и короткоживущие данные.**

```typescript
// composables/useTasks.ts
export function useTasks(projectId: string) {
  return useQuery({
    queryKey: ['tasks', projectId],
    queryFn: () => api.tasks.list(projectId),
    staleTime: 30_000,
  })
}
```

Мутации с оптимистичным обновлением:
```typescript
const { mutate: moveTask } = useMutation({
  mutationFn: api.tasks.move,
  onMutate: async (variables) => {
    // optimistic
    await queryClient.cancelQueries(['tasks', projectId])
    const prev = queryClient.getQueryData(['tasks', projectId])
    queryClient.setQueryData(['tasks', projectId], applyMove(prev, variables))
    return { prev }
  },
  onError: (_, __, ctx) => {
    queryClient.setQueryData(['tasks', projectId], ctx.prev)
  },
  onSettled: () => queryClient.invalidateQueries(['tasks', projectId]),
})
```

## Real-time: SSE

```typescript
// composables/useSSE.ts
export function useSSE() {
  const workspaceId = useWorkspace().currentId
  onMounted(() => {
    const es = new EventSource(`/api/v1/workspaces/${workspaceId}/stream`)
    es.addEventListener('task_moved', (e) => {
      const data = JSON.parse(e.data)
      queryClient.invalidateQueries(['tasks'])
    })
  })
}
```

## UX-переводы цифр в действия

Каждый числовой результат сопровождается интерпретацией:

| Сырое | Что видит пользователь |
|-------|------------------------|
| `p95 cycle time = 4.2d` | «10% задач в Review висят дольше 4 дней — посмотри, нет ли блокеров» |
| `WIP optimum = 5` | «По Little's Law (throughput 10/нед × cycle 3.5д) оптимум WIP = 5. Текущий — 8. Возможно, избыточно» |
| `MC probability = 78%` | «С высокой вероятностью спринт будет закрыт в срок. Риск — 22%.» |
| `N < 30` | «Недостаточно данных для перцентилей. Нужно минимум 30 закрытых задач; сейчас — {n}.» |

Тексты в `lib/analytics-copy.ts` — легко менять, переводить.

## Условия отображения аналитики

- Если задач `<30` → не показываем перцентили; placeholder с приглашением.
- Если спринтов `<3` → Monte Carlo недоступен.
- Если событий `<7 дней` → CFD placeholder «подожди неделю работы».

## Формы и валидация

- `vee-validate` + `zod` (типизированные схемы).
- Ошибки API отображаются полем-специфично через маппинг кодов.
- Inline-валидация при blur.

## Иконки

- `@nuxt/icon` + Lucide collection — основной набор.
- Heroicons outline — как запасной.
- Собственные SVG только для брендовых элементов (лого).

## Accessibility

- Nuxt UI (Reka UI под капотом) обеспечивает a11y по умолчанию.
- WCAG AA для контраста (основные тексты на dark background — уже соответствуют).
- Focus-ring включён.
- Keyboard navigation проверяется на основных флоу (login, task create, board drag — LATER через accessible DnD).

## Dual-track

### Current (MVP)
- SPA режим без SSR.
- Nuxt UI для базовых компонентов.
- Inspira UI для login/register hero + dashboard glass-cards.
- ECharts для 3–4 ключевых графиков.
- Tailwind + кастомные CSS variables для палитры.
- Только тёмная тема.
- Ручной API-клиент.
- Pinia + базовое vue-query.

### Target
- kubb-сгенерированный type-safe клиент.
- Полный набор Inspira UI эффектов + vue-bits анимации.
- Тёмная + светлая темы.
- E2E-тесты (Playwright).
- Полная accessibility проверка.
- I18n (RU + EN).

### Evolution
- Переход с ручного клиента на kubb — когда API стабилизируется.
- Светлая тема — после запуска MVP, по запросу пользователей.
- Анимации vue-bits добавляются постепенно, в первую очередь на landing / upgrade-CTA.
- Mobile-friendly остаётся (адаптив), но полноценное mobile app — в следующих фазах.

## Связанные документы
- [`06-system-architecture.md`](06-system-architecture.md) — backend-контрагент
- [`08-backend-design.md`](08-backend-design.md) — API
- [`10-analytics-design.md`](10-analytics-design.md) — что визуализируем
- [`11-non-functional.md`](11-non-functional.md) — accessibility requirements