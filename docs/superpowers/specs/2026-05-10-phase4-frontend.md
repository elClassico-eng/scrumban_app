# Phase 4 — Frontend MVP (Nuxt 4 + Nuxt UI v4)

**Дата:** 2026-05-10
**Статус:** active spec/plan (один документ — служит и как ТЗ, и как пошаговая дорожная карта)
**Ветка:** `feature/phase4-frontend` (создаётся в Step 0)
**Связанные документы:**
- [`docs/09-frontend-design.md`](../../09-frontend-design.md) — обзор архитектуры (Current/Target)
- [`docs/06-system-architecture.md`](../../06-system-architecture.md) — backend архитектура, SSE
- [`docs/11-non-functional.md`](../../11-non-functional.md) — RBAC матрица, NFR
- [`docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`](2026-04-23-nuxt-monorepo-pivot.md) — master pivot spec

---

## 1. Цель

Реализовать SPA-фронтенд для Scrumban-платформы поверх готового Nitro-бэкенда (44 эндпоинта, 124 теста, 6 доменов: auth, workspaces, boards+columns, tasks, sprints, analytics).

К защите magistr-проекта (3 месяца до предзащиты) фронтенд должен **полностью отражать backend-функционал** через современный стек: Nuxt 4 + Nuxt UI v4 + Pinia + TanStack Query + ECharts + vuedraggable, со строгой типизацией и codegen на границах слоёв.

Не строим backend-фичи в этой Phase. Если в ходе UI-работы выявляется gap бэкенда — фиксируем в COMPACT.md backlog и обрабатываем отдельно.

---

## 2. Что есть в бэкенде (фиксируем сейчас, чтобы фронт это покрыл)

### Эндпоинты по доменам (44)

**Auth (4)**: `register`, `login`, `logout`, `session`
**Workspaces (3)**: `list`, `create`, `get-by-id`
**Workspace members (4)**: `list`, `add`, `update-role`, `remove`
**Boards (4)**: `list`, `create`, `get`, `update`, `delete`
**Columns (5)**: `list`, `create`, `update`, `delete`, `reorder`
**Tasks (6)**: `list`, `create`, `get`, `update`, `move`, `delete` + `events.get` (audit log)
**Sprints (7)**: `list`, `create`, `get`, `update`, `delete`, `start`, `close` + `tasks.add`, `tasks.remove`
**Analytics (5)**: `cfd`, `cycle-time`, `monte-carlo`, `throughput`, `wip-recommendations`
**Realtime (1)**: `stream` (SSE — board updates)
**Health (1)**: `healthz`

Точный список: `find server/api -type f -name "*.ts" -not -name "*.test.ts"` (verified 2026-05-10).

### Доменные сущности (9 таблиц)

`users`, `workspaces`, `workspace_members` (роли: `viewer < member < scrum_master < admin < owner`), `boards`, `board_columns`, `tasks`, `task_events` (audit log), `sprints` (state: `planned/active/closed`), `sprint_tasks`.

### Ключевые инварианты

- **Multi-tenancy**: все запросы (кроме auth) ходят с workspace-контекстом. RLS в Postgres делает фильтрацию автоматически (RLS включён на 6 таблицах: boards, board_columns, tasks, task_events, sprints, sprint_tasks).
- **RBAC**: 5 ролей. `viewer` читает, `member` создаёт/редактирует свои задачи, `scrum_master` управляет спринтами, `admin` управляет участниками+досками, `owner` владеет workspace.
- **Sprint state machine**: `planned → active → closed`. Cancel = шорткат `planned → closed`.
- **SSE**: один long-lived канал `/api/workspaces/:id/boards/:boardId/stream` шлёт события `task_created/moved/closed/...` после успешного коммита транзакции.
- **Analytics требует MIN_DAYS_OF_HISTORY=14** и хотя бы одну закрытую задачу для Monte Carlo.

---

## 3. Архитектурные принципы (требования пользователя зафиксированы)

1. **Стилизация**:
   - **Tailwind 4 CSS-first** через `@theme static { ... }` в `app/assets/css/main.css` (Nuxt UI v4 требует Tailwind v4, классический `tailwind.config.js` ушёл).
   - Никакого хардкода стилей в `<style>` блоках компонентов: используем design tokens (через CSS variables) и Tailwind-классы.
   - `app.config.ts` — глобальные тематические оверрайды Nuxt UI компонентов (slots / variants / defaultVariants).

2. **Pinia стор**:
   - **Декомпозирован по доменам**, не один монолитный.
   - **Только локальный/UI state** (фильтры, выбранный id, открытые модалки, режим отображения). Серверный state живёт в кэше TanStack Query.
   - **Действия (actions) выносим в composables** и переиспользуем как из стора, так и напрямую из компонентов. Setup-синтаксис Pinia это поддерживает (`defineStore('x', () => { const { mutate } = useXMutation(); return { mutate } })`).

3. **Компоненты и логика**:
   - Компоненты переиспользуемые, без бизнес-логики (она в composables/services).
   - Хелперы и форматтеры → `app/utils/` (например, `formatRelativeDate`, `formatTaskStatus`, `humanizeRole`).

4. **Codegen на границах**:
   - Zod-схемы из бэкенда → openapi.yaml → `shared/types/api.d.ts` (через openapi-typescript). Frontend импортирует ТОЛЬКО из `shared/types/`, а не из `server/`.
   - Для форм: тот же zod-источник используется через Nuxt UI v4 `<UForm :schema="zodSchema" :state="stateObj">` — Nuxt UI v4 принимает zod схемы напрямую и сам выкидывает `FormValidationException`, никаких сторонних adapter'ов.

5. **Codegen-разрыв (важно для Step 0)**: на сегодня (2026-05-10) пайплайн `zod → openapi → ts-client` ещё **не реализован** в бэкенде. Это в Target секции `08-backend-design.md`. Поэтому в Step 0 мы временно объявляем типы вручную в `shared/types/` под endpoint, а codegen-пайплайн добавляем как Target-задачу (триггер: ≥3 сигнатуры разошлись с бэкендом → подключаем codegen).

---

## 4. Стек (latest stable, 2026-05)

| Категория | Либа | Версия | Назначение |
|---|---|---|---|
| Framework | Nuxt | 4.x | SPA mode (`ssr: false`) |
| UI base | @nuxt/ui | 4.x | компонентная библиотека (Reka UI + Tailwind 4) |
| Стили | tailwindcss | 4.x (через @nuxt/ui) | utility-first CSS |
| State (UI) | pinia + @pinia/nuxt | latest | UI/локальное состояние |
| State (server) | @tanstack/vue-query | 5.x | кэш серверных запросов, мутации, invalidation |
| Forms | `<UForm :schema :state>` (Nuxt UI v4) | — | валидация zod-схемой нативно, без сторонних adapter'ов |
| Drag-n-drop | vuedraggable@next | 4.x для Vue 3 | перетаскивание задач между колонками |
| Charts | echarts + vue-echarts | latest | CFD, Monte Carlo, scatter, throughput |
| Утилиты | @vueuse/core | latest | useEventSource (SSE), useStorage, useDebounce |
| Иконки | @nuxt/icon | latest | Lucide / Heroicons через iconify |
| Шрифты | @nuxt/google-fonts | latest | Inter (UI) + JetBrains Mono (code) |

**Inspira UI** и **vue-bits** — точечно для landing/анимаций, добавляем по мере необходимости (не как база). Установка через копирование исходников.

**Не используем**: NextUI/HeroUI (это для React), Vuetify, PrimeVue, Element Plus, Naive UI.

---

## 5. Целевая структура папок

```
scrumban_app/
├── app/
│   ├── assets/
│   │   └── css/
│   │       └── main.css              # @import tailwindcss + @import @nuxt/ui + @theme
│   ├── components/
│   │   ├── auth/                     # LoginForm.vue, RegisterForm.vue
│   │   ├── workspace/                # WorkspaceSwitcher.vue, MemberRow.vue, MemberRoleBadge.vue
│   │   ├── board/                    # BoardCanvas.vue, BoardColumn.vue, BoardHeader.vue
│   │   ├── task/                     # TaskCard.vue, TaskDrawer.vue, TaskEventTimeline.vue
│   │   ├── sprint/                   # SprintCard.vue, SprintStateBadge.vue
│   │   ├── analytics/                # CfdChart.vue, MonteCarloChart.vue, CycleTimeScatter.vue, ThroughputChart.vue, WipRecommendationsCard.vue
│   │   └── ui/                       # AppShell.vue, AppHeader.vue, AppSidebar.vue, EmptyState.vue, LoadingState.vue, ErrorState.vue
│   ├── composables/
│   │   ├── useApi.ts                 # типизированный $fetch wrapper
│   │   ├── useSse.ts                 # SSE подписка (через useEventSource)
│   │   ├── api/                      # один файл на ресурс
│   │   │   ├── useAuthApi.ts         # login/register/logout/session как mutations + useSessionQuery
│   │   │   ├── useWorkspacesApi.ts
│   │   │   ├── useMembersApi.ts
│   │   │   ├── useBoardsApi.ts
│   │   │   ├── useColumnsApi.ts
│   │   │   ├── useTasksApi.ts
│   │   │   ├── useSprintsApi.ts
│   │   │   └── useAnalyticsApi.ts
│   │   └── domain/                   # composables, выходящие за рамки одного API
│   │       ├── useTaskMove.ts        # инкапсулирует optimistic update + invalidation для drag-n-drop
│   │       └── useSprintTransition.ts
│   ├── stores/
│   │   ├── auth.store.ts             # session ref, derived isAuthenticated
│   │   ├── workspace.store.ts        # currentWorkspaceId, sidebar collapsed
│   │   ├── board.store.ts            # currentBoardId, ui state доски
│   │   ├── task-filters.store.ts     # фильтры/sort на доске (только UI)
│   │   └── ui.store.ts               # глобальные модалки, toast queue, theme
│   ├── routing/
│   │   └── index.ts                  # apiRoutes (все backend URL) + pageRoutes (frontend pages) — единый манифест
│   ├── utils/
│   │   ├── format.ts                 # formatRelativeDate, formatPercentile, formatBytes
│   │   ├── humanize.ts               # humanizeRole, humanizeTaskEventType, humanizeSprintState
│   │   ├── colors.ts                 # roleToBadgeColor, sprintStateToColor
│   │   └── errors.ts                 # extractApiError, isAuthError
│   ├── middleware/
│   │   ├── auth.global.ts            # редирект на /login если нет сессии
│   │   └── workspace.ts              # требует выбранный workspace
│   ├── pages/
│   │   ├── index.vue                 # редирект на /workspaces или /login
│   │   ├── login.vue
│   │   ├── register.vue
│   │   ├── workspaces/
│   │   │   ├── index.vue             # список workspaces
│   │   │   └── [id]/
│   │   │       ├── index.vue         # редирект на /boards
│   │   │       ├── boards/
│   │   │       │   ├── index.vue     # список досок
│   │   │       │   └── [boardId]/
│   │   │       │       ├── index.vue # доска (kanban view)
│   │   │       │       ├── analytics.vue
│   │   │       │       └── sprints.vue
│   │   │       └── members.vue
│   │   └── 404.vue
│   ├── layouts/
│   │   ├── default.vue               # AppShell с sidebar
│   │   ├── auth.vue                  # без sidebar для /login и /register
│   │   └── error.vue
│   ├── plugins/
│   │   └── vue-query.ts              # VueQueryPlugin + QueryClient
│   ├── app.config.ts                 # тема Nuxt UI
│   └── app.vue                       # <UApp><NuxtLayout><NuxtPage /></NuxtLayout></UApp>
├── shared/
│   └── types/
│       ├── api.d.ts                  # сгенерированные (Target) или вручную (Current) типы
│       ├── domain.ts                 # доменные типы (Role, SprintState, TaskEventType — синхронизировано с server/db/schema)
│       └── index.ts                  # ре-экспорт
└── server/                           # без изменений в этой phase
```

---

## 6. Design system

### 6.1 Палитра (стартовая, можно поменять позже)

Используем **встроенные палитры Tailwind** через alias в `app.config.ts` — без кастомных hex (быстро, легко поменять):

| Семантика | Палитра | Назначение |
|---|---|---|
| `primary` | `indigo` | CTA, активные состояния, выделение |
| `secondary` | `violet` | вторичные акценты |
| `neutral` | `slate` | текст, фон, бордеры (поддерживает dark mode из коробки) |
| `success` | `emerald` | подтверждения, закрытые задачи |
| `info` | `sky` | информационные toast/badge |
| `warning` | `amber` | предупреждения, незавершённые спринты |
| `error` | `red` | ошибки, удаление, критичные алерты |

### 6.2 Шрифты

- **UI / Body**: `Manrope` (через `@nuxt/google-fonts`) — современный геометрический sans, близко к Apple SF Pro Display по характеру, screen-optimized, отлично читается в плотном UI (kanban + analytics tables). Переменный, поддерживает кириллицу.
- **Code/mono**: `JetBrains Mono` — для отображения id, кодов ошибок, JSON в task events.

### 6.3 Spacing/radius (по умолчанию Nuxt UI)

Не переопределяем сейчас. Если возникнут специфические требования — добавим в `@theme` блок.

### 6.4 Dark mode

Поддерживаем сразу. Nuxt UI v4 имеет встроенный colorMode. Toggle в header.

---

## 7. Pinia + Composables: канонический паттерн

Это критично — пользователь сформулировал явно, фиксируем образец.

### 7.1 Композабл с API (вся бизнес-логика и серверные мутации)

```ts
// app/composables/api/useTasksApi.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import type { Ref } from 'vue'
import { apiRoutes } from '~/routing'
import type { Task, CreateTaskInput, MoveTaskInput } from '~/shared/types'

export function useTasksApi(boardId: Ref<string | null>, workspaceId: Ref<string | null>) {
  const qc = useQueryClient()

  const tasksQuery = useQuery({
    queryKey: ['tasks', workspaceId, boardId],
    queryFn: () => $fetch<Task[]>(apiRoutes.tasks(workspaceId.value!, boardId.value!)),
    enabled: computed(() => !!boardId.value && !!workspaceId.value),
  })

  const createTask = useMutation({
    mutationFn: (input: CreateTaskInput) =>
      $fetch<Task>(apiRoutes.tasks(workspaceId.value!, boardId.value!), {
        method: 'POST',
        body: input,
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', workspaceId, boardId] }),
  })

  const moveTask = useMutation({
    mutationFn: (input: MoveTaskInput) =>
      $fetch(apiRoutes.taskMove(workspaceId.value!, boardId.value!, input.taskId), {
        method: 'POST',
        body: { columnId: input.toColumnId, position: input.position },
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tasks', workspaceId, boardId] }),
  })

  return { tasksQuery, createTask, moveTask }
}
```

### 7.2 Стор — только UI state

```ts
// app/stores/task-filters.store.ts
import { defineStore } from 'pinia'

export const useTaskFiltersStore = defineStore('task-filters', () => {
  const search = ref('')
  const assigneeId = ref<string | null>(null)
  const showArchived = ref(false)

  function reset() {
    search.value = ''
    assigneeId.value = null
    showArchived.value = false
  }

  return { search, assigneeId, showArchived, reset }
})
```

### 7.3 Композиция в компоненте

```vue
<script setup lang="ts">
const route = useRoute()
const workspaceId = computed(() => route.params.id as string)
const boardId = computed(() => route.params.boardId as string)

const filters = useTaskFiltersStore()
const { tasksQuery, createTask, moveTask } = useTasksApi(boardId, workspaceId)

const filteredTasks = computed(() => {
  return (tasksQuery.data.value ?? []).filter(t =>
    (!filters.search || t.title.toLowerCase().includes(filters.search.toLowerCase())) &&
    (!filters.assigneeId || t.assigneeId === filters.assigneeId) &&
    (filters.showArchived || !t.archivedAt)
  )
})
</script>
```

**Что это даёт**:
- Стор не дёргает API напрямую — он держит фильтры и точка.
- Composable можно использовать из любого компонента БЕЗ стора (например, в модалке создания задачи).
- vue-query сам кэширует, инвалидирует, дедуплицирует параллельные подписки на одну query key.

---

## 8. Codegen-стратегия (Current vs Target)

### Current (Phase 4 MVP)

- Типы вручную в `shared/types/domain.ts` (статичные enums) и `shared/types/api.d.ts` (request/response shapes).
- Источник истины — Drizzle schemas (`server/db/schema/*.ts`); если расходится — поправили вручную.
- Тестируем что типы корректны через `nuxt typecheck` (уже есть скрипт в `package.json`).

### Target (триггер: ≥3 разошедшиеся сигнатуры или ручное обновление типов > 1 раза за неделю)

1. В бэкенде ввести `zod-to-openapi`: каждый endpoint регистрирует свою input/output zod-схему в общем `OpenAPIRegistry`.
2. Скрипт `bun run codegen` генерирует `openapi/scrumban.yaml` (через `OpenAPIGenerator.generateDocument`).
3. `openapi-typescript` из YAML → `shared/types/api.generated.ts`.
4. CI failit если типы устарели (diff после codegen → ошибка).

Эта работа выходит за Phase 4 — переносим в backend-backlog (см. COMPACT.md).

---

## 9. Step 0 — Foundation

### 9.1 Цель Step 0

Готовая инфраструктура для разработки фичей: установлены либы, настроена тема, работает Pinia + vue-query, есть базовый `AppShell` layout, есть типизированный `useApi` composable.

После Step 0 dev-режим (`bun run dev`) показывает пустую главную с layout-ом (header + sidebar заглушка), типы проходят `bun run typecheck`, тесты `bun run test` зелёные.

### 9.2 Pre-step: pnpm → bun sweep

В документации остался хвост (`pnpm install`, `pnpm run dev`) после прошлой синхронизации. Перед фронтом — заменим, чтобы команды в дальнейших шагах были однозначные.

**Файлы**:
- `docs/08-backend-design.md`
- `docs/11-non-functional.md`
- `docs/12-deployment.md`
- `docs/superpowers/specs/2026-04-23-nuxt-monorepo-pivot.md`

**Действие**: `grep -rn "pnpm" docs/` → заменить на `bun` (с поправкой на синтаксис: `pnpm install` → `bun install`, `pnpm run dev` → `bun run dev`, `pnpm dlx X` → `bunx X`).

**Коммит**: `chore: replace pnpm references with bun in docs`

### 9.3 Установка зависимостей

```bash
bun install pinia @pinia/nuxt
bun install @tanstack/vue-query
bun install vuedraggable@next
bun install echarts vue-echarts
bun install @vueuse/core
bun install @nuxt/icon
bun install slugify
bun install -D @nuxtjs/google-fonts
```

(Inspira UI / vue-bits добавим точечно позже.)

> **Note (post-impl):** изначально спека предлагала `vee-validate` + `@vee-validate/zod` для валидации форм. После того, как мы убедились что `<UForm :schema :state>` Nuxt UI v4 принимает zod-схему напрямую, эти зависимости были удалены — ни одна форма проекта их не использует. См. коммит `chore: drop unused vee-validate`.

**Проверка**: `bun run typecheck` зелёный, `bun run test` зелёный.

**Коммит**: `chore: add frontend dependencies for Phase 4 (pinia, vue-query, echarts, vuedraggable, slugify)`

### 9.4 Скелет папок

Создать пустые директории + index-файлы где нужны:

```bash
mkdir -p app/components/{auth,workspace,board,task,sprint,analytics,ui}
mkdir -p app/composables/{api,domain}
mkdir -p app/stores
mkdir -p app/utils
mkdir -p app/middleware
mkdir -p app/layouts
mkdir -p app/plugins
mkdir -p app/assets/css
mkdir -p app/pages/workspaces/[id]/boards/[boardId]
mkdir -p app/pages/workspaces/[id]/{members,boards}
mkdir -p shared/types
```

Чтобы папки попали в git — кидаем `.gitkeep` в пустые.

### 9.5 Конфигурация

#### `nuxt.config.ts` — обновлённый

```ts
export default defineNuxtConfig({
  compatibilityDate: '2025-04-01',
  devtools: { enabled: true },
  ssr: false,

  modules: [
    '@nuxt/ui',
    '@nuxt/eslint',
    '@nuxt/icon',
    '@nuxtjs/google-fonts',
    'nuxt-auth-utils',
    '@pinia/nuxt',
  ],

  css: ['~/assets/css/main.css'],

  googleFonts: {
    families: {
      Manrope: [400, 500, 600, 700, 800],
      'JetBrains Mono': [400, 500],
    },
    display: 'swap',
  },

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL || '',
    sessionPassword: process.env.NUXT_SESSION_PASSWORD || '',
  },

  typescript: {
    strict: true,
    typeCheck: false,
  },
})
```

#### `app/assets/css/main.css`

```css
@import "tailwindcss";
@import "@nuxt/ui";

@theme static {
  --font-sans: 'Manrope', system-ui, sans-serif;
  --font-mono: 'JetBrains Mono', ui-monospace, monospace;
}
```

(Кастомные hex палитры на старте не вводим — используем встроенные Tailwind палитры через `app.config.ts`.)

#### `app/app.config.ts`

```ts
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'indigo',
      secondary: 'violet',
      neutral: 'slate',
      success: 'emerald',
      info: 'sky',
      warning: 'amber',
      error: 'red',
    },
    button: {
      defaultVariants: {
        color: 'primary',
        variant: 'solid',
        size: 'md',
      },
    },
    card: {
      slots: {
        root: 'rounded-lg',
      },
    },
  },
})
```

#### `app/plugins/vue-query.ts`

```ts
import { VueQueryPlugin, QueryClient } from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxt) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
      mutations: {
        retry: 0,
      },
    },
  })

  nuxt.vueApp.use(VueQueryPlugin, { queryClient })
})
```

(SPA-режим — пропускаем dehydrate/hydrate, они нужны только для SSR.)

### 9.6 Routing manifest — единое место для всех URL

Требование зафиксировано: все URL (и backend API, и frontend pages) живут в одном TS-файле, экспортируются именованными константами/билдерами. Никаких `'/api/...'` или `'/login'` в коде вне этого файла.

**Файл**: `app/routing/index.ts`. Два экспорта:
- `apiRoutes` — все 44 backend URL.
- `pageRoutes` — все frontend page paths.

```ts
// app/routing/index.ts
//
// Single source of truth for every URL in the app.
// Composables consume `apiRoutes`; navigation (router.push, navigateTo,
// <NuxtLink :to>) uses `pageRoutes`. String literals like '/api/...' or
// '/login' must NOT appear elsewhere in the codebase.

const boardBase = (wsId: string, boardId: string) =>
  `/api/workspaces/${wsId}/boards/${boardId}`

export const apiRoutes = {
  // Auth
  authRegister: '/api/auth/register',
  authLogin: '/api/auth/login',
  authLogout: '/api/auth/logout',
  authSession: '/api/auth/session',

  // Health
  healthz: '/api/healthz',

  // Workspaces
  workspaces: '/api/workspaces',
  workspace: (id: string) => `/api/workspaces/${id}`,

  // Members
  members: (wsId: string) => `/api/workspaces/${wsId}/members`,
  member: (wsId: string, userId: string) => `/api/workspaces/${wsId}/members/${userId}`,

  // Boards
  boards: (wsId: string) => `/api/workspaces/${wsId}/boards`,
  board: boardBase,

  // Columns
  columns: (wsId: string, boardId: string) => `${boardBase(wsId, boardId)}/columns`,
  column: (wsId: string, boardId: string, columnId: string) =>
    `${boardBase(wsId, boardId)}/columns/${columnId}`,
  columnsReorder: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/columns/reorder`,

  // Tasks
  tasks: (wsId: string, boardId: string) => `${boardBase(wsId, boardId)}/tasks`,
  task: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}`,
  taskMove: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/move`,
  taskEvents: (wsId: string, boardId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/tasks/${taskId}/events`,

  // Sprints
  sprints: (wsId: string, boardId: string) => `${boardBase(wsId, boardId)}/sprints`,
  sprint: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}`,
  sprintStart: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/start`,
  sprintClose: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/close`,
  sprintTasks: (wsId: string, boardId: string, sprintId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/tasks`,
  sprintTask: (wsId: string, boardId: string, sprintId: string, taskId: string) =>
    `${boardBase(wsId, boardId)}/sprints/${sprintId}/tasks/${taskId}`,

  // Analytics
  analyticsCfd: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/analytics/cfd`,
  analyticsCycleTime: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/analytics/cycle-time`,
  analyticsMonteCarlo: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/analytics/monte-carlo`,
  analyticsThroughput: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/analytics/throughput`,
  analyticsWipRecommendations: (wsId: string, boardId: string) =>
    `${boardBase(wsId, boardId)}/analytics/wip-recommendations`,

  // SSE realtime
  boardStream: (wsId: string, boardId: string) => `${boardBase(wsId, boardId)}/stream`,
} as const

export const pageRoutes = {
  home: '/',
  login: '/login',
  register: '/register',

  workspaces: '/workspaces',
  workspace: (id: string) => `/workspaces/${id}`,
  workspaceMembers: (id: string) => `/workspaces/${id}/members`,

  boards: (wsId: string) => `/workspaces/${wsId}/boards`,
  board: (wsId: string, boardId: string) => `/workspaces/${wsId}/boards/${boardId}`,
  boardAnalytics: (wsId: string, boardId: string) =>
    `/workspaces/${wsId}/boards/${boardId}/analytics`,
  boardSprints: (wsId: string, boardId: string) =>
    `/workspaces/${wsId}/boards/${boardId}/sprints`,
} as const

export type ApiRoutes = typeof apiRoutes
export type PageRoutes = typeof pageRoutes
```

**Правило enforcement**: если в `useXApi` или middleware появляется literal `'/api/...'` / `'/login'` — это сигнал, что в манифесте не хватает entry. Добавляем в `apiRoutes`/`pageRoutes`, не плодим строки по проекту.

**Бонус (Target)**: можно потом сделать tagged-template helper типа `apiUrl\`/api/workspaces/${wsId}/boards/${boardId}\`` с runtime-валидацией параметров через zod, но для MVP функций-билдеров достаточно.

### 9.7 Базовый `useApi` composable

```ts
// app/composables/useApi.ts
// Lightweight wrapper around $fetch with consistent error mapping.
// vue-query hooks (useQuery/useMutation) inside composables/api/* call this.
export function useApi() {
  const router = useRouter()

  async function api<T>(url: string, opts?: Parameters<typeof $fetch>[1]): Promise<T> {
    try {
      return await $fetch<T>(url, opts)
    } catch (err: any) {
      if (err?.statusCode === 401) {
        await router.push('/login')
      }
      throw err
    }
  }

  return { api }
}
```

### 9.8 Layout shell

#### `app/layouts/default.vue`

```vue
<template>
  <div class="min-h-screen flex">
    <AppSidebar />
    <div class="flex-1 flex flex-col">
      <AppHeader />
      <main class="flex-1 overflow-auto p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
```

#### `app/layouts/auth.vue`

```vue
<template>
  <div class="min-h-screen flex items-center justify-center bg-neutral-50 dark:bg-neutral-950">
    <div class="w-full max-w-md p-8">
      <slot />
    </div>
  </div>
</template>
```

#### `app/components/ui/AppHeader.vue`, `AppSidebar.vue`

Заглушки с базовой разметкой и `<UButton>`/`<UIcon>` — настоящий контент появится в Step 1+.

### 9.9 `app/app.vue` — обновлённый

```vue
<template>
  <UApp>
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </UApp>
</template>
```

### 9.10 Утилиты-стартеры

```ts
// app/utils/humanize.ts
import type { Role, SprintState, TaskEventType } from '~/shared/types/domain'

export function humanizeRole(role: Role): string {
  const map: Record<Role, string> = {
    viewer: 'Наблюдатель',
    member: 'Участник',
    scrum_master: 'Скрам-мастер',
    admin: 'Администратор',
    owner: 'Владелец',
  }
  return map[role] ?? role
}

export function humanizeSprintState(s: SprintState): string {
  return { planned: 'Запланирован', active: 'Активен', closed: 'Закрыт' }[s] ?? s
}

export function humanizeTaskEventType(t: TaskEventType): string {
  const map: Record<TaskEventType, string> = {
    task_created: 'Создана',
    task_moved: 'Перемещена',
    task_closed: 'Закрыта',
    task_reopened: 'Переоткрыта',
    task_assigned: 'Назначена',
    task_updated: 'Обновлена',
    task_archived: 'Архивирована',
  }
  return map[t] ?? t
}
```

```ts
// app/utils/format.ts
export function formatRelativeDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso
  return new Intl.RelativeTimeFormat('ru', { numeric: 'auto' }).format(
    Math.round((d.getTime() - Date.now()) / 86_400_000),
    'day',
  )
}

export function formatPercentile(value: number, total: number): string {
  return `${Math.round((value / total) * 100)}%`
}
```

### 9.11 `shared/types/domain.ts`

```ts
export type Role = 'viewer' | 'member' | 'scrum_master' | 'admin' | 'owner'
export type SprintState = 'planned' | 'active' | 'closed'
export type TaskEventType =
  | 'task_created'
  | 'task_moved'
  | 'task_closed'
  | 'task_reopened'
  | 'task_assigned'
  | 'task_updated'
  | 'task_archived'

export interface Task {
  id: string
  workspaceId: string
  boardId: string
  columnId: string
  title: string
  description: string | null
  assigneeId: string | null
  position: number
  createdAt: string
  updatedAt: string
  closedAt: string | null
  archivedAt: string | null
}

// и так далее: Workspace, Board, Column, Sprint, Member ...
```

(Дополнять по мере нужды в Step 1+.)

### 9.12 Верификация Step 0

- [ ] `bun run dev` запускается без ошибок
- [ ] `bun run typecheck` зелёный
- [ ] `bun run test` зелёный (124 теста как было)
- [ ] Открытие `/` показывает layout с заглушками header/sidebar
- [ ] Devtools видит установленную тему (indigo primary, slate neutral)
- [ ] Toggle dark mode работает
- [ ] `app/routing/index.ts` существует: 30 URL-билдеров в `apiRoutes` (покрывают все 44 backend-endpoint'а) + 10 entry в `pageRoutes`
- [ ] grep `'/api/'` по `app/` возвращает только `app/routing/index.ts`

**Коммит после Step 0**: один или несколько по логическим единицам (`chore: ...`, `feat: setup AppShell layout`, etc.).

---

## 10. Step 1 — Auth flow

### 10.1 Что делаем

Полный auth-цикл: register → login → автологин при наличии сессии → logout. Middleware для защищённых роутов.

### 10.2 Файлы

- `app/pages/login.vue`, `app/pages/register.vue` (layout: `auth`)
- `app/components/auth/LoginForm.vue`, `RegisterForm.vue`
- `app/composables/api/useAuthApi.ts` — useLoginMutation, useRegisterMutation, useLogoutMutation, useSessionQuery
- `app/stores/auth.store.ts` — текущий пользователь как ref, derived `isAuthenticated`
- `app/middleware/auth.global.ts` — редирект на `/login` если нет сессии (кроме публичных страниц)

### 10.3 Composable: `useAuthApi.ts`

> **Aligned with backend 2026-05-11:** `/api/auth/session` бросает 401 при отсутствии сессии (не возвращает `{user: null}`), а `RegisterSchema` принимает только `{email, password}` (никакого `displayName`). Поэтому `SessionResponse.user` — не-nullable, `RegisterInput` без displayName, и у `sessionQuery` стоит `retry: false`.

```ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { apiRoutes, pageRoutes } from '~/routing'
import type {
  SessionResponse,
  LoginInput,
  RegisterInput,
} from '#shared/types/auth'

export function useAuthApi() {
  const qc = useQueryClient()
  const router = useRouter()

  const sessionQuery = useQuery({
    queryKey: ['auth', 'session'],
    queryFn: () => $fetch<SessionResponse>(apiRoutes.authSession),
    staleTime: 5 * 60_000,
    retry: false, // не дёргать 401 повторно
  })

  const login = useMutation({
    mutationFn: (input: LoginInput) =>
      $fetch<SessionResponse>(apiRoutes.authLogin, { method: 'POST', body: input }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auth', 'session'] })
      await router.push(pageRoutes.workspaces)
    },
  })

  const register = useMutation({
    mutationFn: (input: RegisterInput) =>
      $fetch<SessionResponse>(apiRoutes.authRegister, { method: 'POST', body: input }),
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ['auth', 'session'] })
      await router.push(pageRoutes.workspaces)
    },
  })

  const logout = useMutation({
    mutationFn: () => $fetch(apiRoutes.authLogout, { method: 'POST' }),
    onSuccess: async () => {
      qc.clear() // дропает кэш других user'ов, не только сессию
      await router.push(pageRoutes.login)
    },
  })

  return { sessionQuery, login, register, logout }
}
```

Типы живут в `shared/types/auth.ts` (там же, где `declare module '#auth-utils'`-augmentation для серверной сессии):

```ts
// shared/types/auth.ts
export interface SessionUser { id: string; email: string }
export interface SessionResponse { user: SessionUser }
export interface LoginInput { email: string; password: string }
export interface RegisterInput { email: string; password: string }
```

### 10.4 Стор: `auth.store.ts`

```ts
import { defineStore } from 'pinia'

export const useAuthStore = defineStore('auth', () => {
  const { sessionQuery } = useAuthApi()

  const user = computed(() => sessionQuery.data.value?.user ?? null)
  const isAuthenticated = computed(() => !!user.value)
  const isLoading = computed(() => sessionQuery.isLoading.value)

  return { user, isAuthenticated, isLoading }
})
```

(Стор тонкий — обёртка над session query для удобного импорта в компонентах.)

### 10.5 Middleware: `auth.global.ts`

```ts
import { pageRoutes } from '~/routing'

const PUBLIC_ROUTES: string[] = [pageRoutes.login, pageRoutes.register]

export default defineNuxtRouteMiddleware(async (to) => {
  if (PUBLIC_ROUTES.includes(to.path)) return

  const { sessionQuery } = useAuthApi()
  if (sessionQuery.isLoading.value) await sessionQuery.suspense()

  if (!sessionQuery.data.value?.user) {
    return navigateTo(pageRoutes.login)
  }
})
```

### 10.6 Форма с Nuxt UI v4 + zod

`<UForm :schema :state>` принимает zod-схему напрямую и сам делает валидацию + ошибки в `<UFormField>`. Серверные ошибки (401 wrong creds) показываем отдельным `<UAlert>`.

```vue
<!-- app/components/auth/LoginForm.vue -->
<script setup lang="ts">
import { z } from 'zod'

const schema = z.object({
  email: z.string().email('Введи корректный email'),
  password: z.string().min(1, 'Введи пароль'),
})

type LoginState = z.infer<typeof schema>
const state = reactive<LoginState>({ email: '', password: '' })

const { login } = useAuthApi()

const errorMessage = computed(() => {
  if (!login.isError.value) return null
  const err = login.error.value as { statusCode?: number } | null
  if (err?.statusCode === 401) return 'Неверный email или пароль'
  return 'Не удалось войти, попробуй позже'
})

function onSubmit() {
  login.mutate(state)
}
</script>

<template>
  <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
    <UFormField label="Email" name="email" required>
      <UInput v-model="state.email" type="email" autocomplete="email" class="w-full" />
    </UFormField>
    <UFormField label="Пароль" name="password" required>
      <UInput v-model="state.password" type="password" autocomplete="current-password" class="w-full" />
    </UFormField>
    <UAlert v-if="errorMessage" color="error" variant="soft" :title="errorMessage" icon="i-lucide-alert-circle" />
    <UButton type="submit" :loading="login.isPending.value" block size="lg">Войти</UButton>
  </UForm>
</template>
```

### 10.7 Верификация Step 1

- [ ] Регистрация создаёт пользователя, авто-логин, редирект на `/workspaces`
- [ ] Вход существующим пользователем работает
- [ ] Logout очищает сессию, редирект на `/login`
- [ ] Заход на `/workspaces` без сессии → `/login`
- [ ] Перезагрузка вкладки сохраняет сессию (cookie)

---

## 11. Step 2 — Workspaces & boards navigation

### 11.1 Что делаем

Список воркспейсов, переключатель в sidebar, страница списка досок выбранного воркспейса, создание workspace/board через модалку. Роутинг иерархичный.

### 11.2 Файлы

- `app/pages/workspaces/index.vue` — список
- `app/pages/workspaces/[id]/index.vue` — редирект на boards
- `app/pages/workspaces/[id]/boards/index.vue` — список досок
- `app/pages/workspaces/[id]/members.vue` — список участников + управление ролями (только admin/owner)
- `app/components/workspace/WorkspaceSwitcher.vue` (в sidebar)
- `app/components/workspace/MemberRow.vue`, `MemberRoleBadge.vue`
- `app/components/board/BoardCard.vue`
- `app/composables/api/useWorkspacesApi.ts`, `useMembersApi.ts`, `useBoardsApi.ts`
- `app/stores/workspace.store.ts` — `currentWorkspaceId` (persisted в localStorage через `@vueuse/core`)

### 11.3 Ключевые UX-решения

- **Workspace switcher** в sidebar: dropdown со списком + «Создать workspace» в конце.
- **При выборе workspace**: записываем в стор и localStorage, редирект на `/workspaces/:id/boards`.
- **Список досок**: grid карточек, на каждой — название, кол-во задач, последняя активность.
- **Создание workspace**: `<UModal>` с полем name (zod-валидация на 1-100 символов).
- **RBAC UI**: для viewer кнопка «Создать доску» disabled, для остальных видна. Роль текущего пользователя в workspace берём из `useSessionQuery`.

### 11.4 Members management

Отдельная страница `/workspaces/:id/members`:
- Список с ролями (badge через `MemberRoleBadge`).
- Кнопки «Изменить роль», «Удалить» — видны только admin/owner.
- Модалка добавления — invite по email (если пользователь существует) → присоединяет к workspace с выбранной ролью.
- Edge cases: нельзя понизить последнего owner (бэкенд проверяет, фронт показывает понятную ошибку из 400).

### 11.5 Верификация Step 2

- [ ] Список workspaces показывает все workspaces пользователя
- [ ] Создание workspace работает, после создания пользователь — owner
- [ ] Свитчер в sidebar работает, последний выбранный сохраняется в localStorage
- [ ] Список досок открывается, создание/удаление доски работает (с правами)
- [ ] Members-страница: viewer не видит кнопку «Изменить роль»; owner видит все

---

## 12. Step 3 — Board view + tasks + SSE

### 12.1 Что делаем

Главный экран продукта: kanban-доска с колонками, drag-n-drop задач, drawer с деталями + историей событий, реалтайм через SSE. Это самый объёмный шаг.

### 12.2 Файлы

- `app/pages/workspaces/[id]/boards/[boardId]/index.vue` — main kanban view
- `app/components/board/BoardCanvas.vue` — обёртка над колонками
- `app/components/board/BoardColumn.vue` — одна колонка с vuedraggable
- `app/components/board/BoardHeader.vue` — название, фильтры (search, assignee), кнопка «Создать задачу»
- `app/components/task/TaskCard.vue` — карточка задачи (compact)
- `app/components/task/TaskDrawer.vue` — drawer с деталями, редактированием, audit log
- `app/components/task/TaskEventTimeline.vue` — список событий из task_events
- `app/composables/api/useTasksApi.ts`, `useColumnsApi.ts`
- `app/composables/domain/useTaskMove.ts` — optimistic update + bind с vuedraggable
- `app/composables/useSse.ts` — подписка на SSE с автоинвалидацией соответствующих query keys
- `app/stores/board.store.ts` — currentBoardId, openTaskId (для drawer)
- `app/stores/task-filters.store.ts` — фильтры/sort

### 12.3 Drag-n-drop через vuedraggable

vuedraggable@4 (для Vue 3) оборачивает SortableJS. Использование:

```vue
<script setup lang="ts">
import draggable from 'vuedraggable'
import type { Task } from '~/shared/types'

const props = defineProps<{ column: BoardColumn; tasks: Task[] }>()
const { moveTask } = useTaskMove()

const localTasks = ref<Task[]>([...props.tasks])
watch(() => props.tasks, (next) => { localTasks.value = [...next] })
</script>

<template>
  <draggable
    v-model="localTasks"
    group="tasks"
    item-key="id"
    @change="moveTask({ columnId: column.id, items: localTasks })"
  >
    <template #item="{ element }">
      <TaskCard :task="element" />
    </template>
  </draggable>
</template>
```

Optimistic update в `useTaskMove`: vue-query `setQueryData` обновляет кэш до ответа сервера, при ошибке — `invalidateQueries` откатывает.

### 12.4 SSE подписка

```ts
// app/composables/useSse.ts
import { useEventSource } from '@vueuse/core'

export function useBoardSse(workspaceId: Ref<string>, boardId: Ref<string>) {
  const url = computed(() => `/api/workspaces/${workspaceId.value}/boards/${boardId.value}/stream`)
  const qc = useQueryClient()

  const { data, status } = useEventSource(url, [
    'task_created', 'task_moved', 'task_closed', 'task_reopened',
    'task_assigned', 'task_updated', 'task_archived',
  ])

  watch(data, () => {
    qc.invalidateQueries({ queryKey: ['tasks', workspaceId, boardId] })
  })

  return { sseStatus: status }
}
```

(Если в backend SSE-канале события сериализуются с `event:` именем — `useEventSource` со списком событий слушает их раздельно. Если просто `data:` — упрощаем до одного listener'а.)

### 12.5 Task drawer

Открывается по клику на карточку. Содержит:
- Title + description (inline edit с дебаунсом).
- Assignee (UAvatar + UDropdown со списком members).
- Column (показывает текущую, можно поменять через select).
- Sprint membership (если задача в активном спринте — показываем badge).
- Audit timeline: список из `tasks/[taskId]/events.get` — кто что когда сделал, через `humanizeTaskEventType`.

### 12.6 Колонки CRUD

В `BoardHeader` — кнопка «Управление колонками» открывает модалку со списком, drag для reorder (тот же vuedraggable, но на колонках), кнопки переименования/удаления/добавления.

### 12.7 Верификация Step 3

- [ ] Доска показывает все колонки и задачи
- [ ] Drag задачи между колонками сохраняется (POST /move)
- [ ] При drag две вкладки: вторая видит изменение через SSE без перезагрузки
- [ ] TaskDrawer открывается, редактирование описания работает
- [ ] Audit timeline показывает все события task_*
- [ ] Reorder колонок работает
- [ ] Фильтры (search, assignee, archived) применяются мгновенно

---

## 13. Step 4 — Sprints & analytics

### 13.1 Что делаем

Sprints page с state machine UI (planned → active → closed). Analytics page со всеми пятью графиками.

### 13.2 Файлы

- `app/pages/workspaces/[id]/boards/[boardId]/sprints.vue`
- `app/pages/workspaces/[id]/boards/[boardId]/analytics.vue`
- `app/components/sprint/SprintCard.vue`, `SprintStateBadge.vue`, `SprintCreateModal.vue`
- `app/components/analytics/CfdChart.vue`, `MonteCarloChart.vue`, `CycleTimeScatter.vue`, `ThroughputChart.vue`, `WipRecommendationsCard.vue`
- `app/composables/api/useSprintsApi.ts`, `useAnalyticsApi.ts`
- `app/composables/domain/useSprintTransition.ts` — start/close + invalidation

### 13.3 Sprint UI

- Список спринтов с фильтром по state.
- Карточка: название, daterange, state-badge, действия по правам (Start, Close — для scrum_master+).
- Внутрь спринта drag-n-drop задач из бэклога (отдельный режим).

### 13.4 Analytics: ECharts

`vue-echarts` обёртка над ECharts. Один общий setup-плагин:

```ts
// app/plugins/echarts.client.ts
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, ScatterChart, CustomChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent, DataZoomComponent } from 'echarts/components'

use([CanvasRenderer, LineChart, BarChart, ScatterChart, CustomChart, GridComponent, TooltipComponent, LegendComponent, DataZoomComponent])

export default defineNuxtPlugin(() => {})
```

Каждый chart-компонент — тонкая обёртка над `<v-chart :option="option" />` с параметризацией данными из соответствующего API-composable.

#### CfdChart
Stacked area по статусам (cumulative count) — daily snapshots от endpoint `/analytics/cfd`.

#### MonteCarloChart
Histogram p50/p85/p95 — endpoint `/analytics/monte-carlo` (требует MIN_DAYS_OF_HISTORY=14 и хотя бы одну закрытую задачу). Показываем error state «Нужно ≥14 дней истории» если бэкенд вернул 422.

#### CycleTimeScatter
Точки (date_closed, cycle_time_days) — endpoint `/analytics/cycle-time`.

#### ThroughputChart
Line — задач в день — endpoint `/analytics/throughput`.

#### WipRecommendationsCard
Текстовая карточка — endpoint `/analytics/wip-recommendations` возвращает JSON `{ column, currentWip, recommendedWip, basedOn: 'littles_law' }`.

### 13.5 Верификация Step 4

- [ ] Создание спринта, переход planned→active, добавление задач, закрытие
- [ ] Запрет на 2 active спринта одновременно (бэкенд → понятная ошибка)
- [ ] Все 5 графиков рендерятся для доски с историей >14 дней
- [ ] При свежей доске CFD пустой, MC показывает «нет данных», корректно
- [ ] Toggle dark mode переключает темы графиков

---

## 14. Conventions & code style

### 14.1 Naming

- Composables: `useXApi` для API, `useXState`/`useX` для UI/domain.
- Stores: `useXStore` (Pinia convention).
- Components: PascalCase (`TaskCard`, `BoardColumn`).
- Pages/layouts: lowercase-kebab.

### 14.2 Imports

- Frontend → backend: только через `~/shared/types/*`. Запрещён `import ... from '~~/server/...'`.
- Cross-component: через auto-import (Nuxt сам сканит `app/components/`).

### 14.3 Styles

- Только Tailwind utility-классы и оверрайды через `app.config.ts` / `:ui="{}"` prop.
- Никаких `<style scoped>` если можно обойтись без них (исключение: специфичные анимации, которые сложно через Tailwind).
- Цвета — только семантические: `text-primary-500`, `bg-error-50` и т.п. Прямые палитры (`text-indigo-500`) только если действительно нужно отойти от семантики.

### 14.4 Errors

- Все ошибки через `extractApiError(err)` (utility) → human-readable string → toast через `useToast()` Nuxt UI.
- Нет вывода raw `err.message` пользователю.

### 14.5 Loading/Empty/Error states

Три универсальных компонента в `components/ui/`:
- `<LoadingState />` — skeleton + текст.
- `<EmptyState :icon :title :description :action />` — для пустых списков с CTA.
- `<ErrorState :error :retry />` — error с кнопкой Retry.

Используем единообразно во всех списках/доске/аналитике.

---

## 15. Тестирование

В Phase 4 минимум:
- **Component tests** через `@nuxt/test-utils` + `vitest` + `happy-dom` для критичных компонентов: LoginForm (валидация), TaskCard (рендер), useAuthApi (моки fetch).
- **E2E** не делаем в этой phase (Phase 5 — `@nuxt/test-utils/e2e` через playwright).
- Существующие 124 backend-теста должны оставаться зелёными после каждого Step.

---

## 16. Что выходит за Phase 4

Эти задачи фиксируются в backlog (см. COMPACT.md), но НЕ блокируют Phase 4:

| Задача | Категория | Триггер для приоритизации |
|---|---|---|
| Codegen `zod → openapi → ts-client` | Backend (Target) | ≥3 разошедшихся типа или ручной правки за неделю |
| Inspira UI / vue-bits для landing | Frontend (Target) | После основного MVP, для предзащиты «вау-эффект» |
| E2E playwright | Frontend testing (Target) | После Phase 5 deployment |
| Mobile-responsive board (touch DnD) | Frontend (Target) | Если в backlog появляется требование |
| Offline-режим / PWA | Frontend (Target) | Не для diploma scope |
| i18n (en/ru toggle) | Frontend (Target) | Если потребуется для защиты |

---

## 17. Порядок выполнения и коммиты

| Шаг | Описание | Ожидаемое количество коммитов | Срок (rough) |
|---|---|---|---|
| 0a | pnpm → bun sweep | 1 | 30 мин |
| 0b | Установка зависимостей | 1 | 15 мин |
| 0c | nuxt.config + main.css + app.config + vue-query plugin | 1 | 1 ч |
| 0d | Routing manifest (`app/routing/index.ts`) | 1 | 30 мин |
| 0e | Layout shell + utilities + shared/types | 1-2 | 2 ч |
| 1 | Auth flow (pages + composable + store + middleware + form) | 2-3 | 1 день |
| 2 | Workspaces + members + boards nav | 3-4 | 1-2 дня |
| 3 | Board + tasks + DnD + SSE + drawer | 5-7 | 3-4 дня |
| 4 | Sprints + 5 analytics charts | 4-5 | 2-3 дня |

**Total**: ~7-10 рабочих дней. После каждого Step: `bun run typecheck` + `bun run test` зелёные, мерж в `main` отдельным коммитом.

---

## 18. Известные риски

1. **vuedraggable + vue-query optimistic updates**: drag generates локальный state, vue-query — серверный. Race conditions возможны (drag → mutation pending → SSE event → invalidate, и сортировка может прыгнуть). Митигация: в `useTaskMove` ставим query в `pause`-режим до ответа сервера, потом resume.

2. **SSE через iOS Safari**: bug с буферизацией bigger payloads. Митигация: keep-alive ping каждые 15с (бэкенд уже шлёт), в крайнем случае fallback на polling каждые 30с.

3. **Nuxt UI v4 + Tailwind 4 — относительно новые**: возможны bugs в edge cases. Митигация: первый блокер → работаем с issues либы, не патчим локально без явной нужды.

4. **Codegen-разрыв (типы вручную)**: если бэкенд меняет API signature, фронт ловит ошибку только на runtime. Митигация: после каждого изменения backend signature — обновить `shared/types/` в том же коммите. Если повторяется > 2 раз — приоритизировать codegen-задачу.

---

## 19. Открытые вопросы (на момент написания)

- **Палитра**: выбран indigo+slate как стартовая. После Step 0 user может pre-review визуала и поменять.
- **Layout**: один default layout с sidebar или несколько (для analytics — без sidebar)? Решаем на Step 2 эмпирически.
- **Inspira UI / vue-bits**: где ожидаются (landing, hero на /login)? На усмотрение пользователя — добавляем точечно.
- **i18n сейчас или нет**: на старте все строки на русском захардкожены. Добавим i18n только если будет требование (триггер: вторая локаль).

---

**Готовность к старту:** после approval этого документа → Step 0a (pnpm→bun sweep), потом 0b (`bun install`).
