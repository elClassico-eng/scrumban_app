<script setup lang="ts">
import { pageRoutes } from '~/routing'
import type { WorkspaceSprintSummary } from '#shared/types/sprint'

const route = useRoute()
const wsId = computed(() => route.params.id as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list } = useWorkspaceSprintsApi(wsId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)

useHead({
  title: () => workspace.value
    ? `${workspace.value.name} — Отчёты`
    : 'Отчёты и ретроспективы — Такт',
})

type BoardGroup = {
  boardId: string
  boardName: string
  active: WorkspaceSprintSummary[]
  closed: WorkspaceSprintSummary[]
}

const groups = computed<BoardGroup[]>(() => {
  const all = list.data.value?.sprints ?? []
  const byBoard = new Map<string, BoardGroup>()
  for (const s of all) {
    if (s.state !== 'active' && s.state !== 'closed') continue
    let g = byBoard.get(s.boardId)
    if (!g) {
      g = { boardId: s.boardId, boardName: s.boardName, active: [], closed: [] }
      byBoard.set(s.boardId, g)
    }
    if (s.state === 'active') g.active.push(s)
    else g.closed.push(s)
  }
  return [...byBoard.values()].filter(g => g.active.length + g.closed.length > 0)
})

const totalReports = computed(() =>
  groups.value.reduce((acc, g) => acc + g.active.length + g.closed.length, 0),
)

function reportPath(s: WorkspaceSprintSummary): string {
  return pageRoutes.sprintReportPage(wsId.value, s.boardId, s.id)
}

function formatDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
}
</script>

<template>
  <div class="space-y-6">
    <div>
      <h1 class="text-2xl font-semibold tracking-tight text-default m-0">Отчёты и ретроспективы</h1>
      <p class="text-sm text-muted mt-1">
        Отчёты и ретроспективы всех спринтов рабочего пространства. Выберите спринт, чтобы открыть его сводку.
      </p>
    </div>

    <div v-if="list.isLoading.value" class="flex items-center justify-center py-16 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div
      v-else-if="totalReports === 0"
      class="text-center py-16 space-y-3 rounded-2xl border border-dashed border-default"
    >
      <UIcon name="i-lucide-clipboard-list" class="size-12 text-muted mx-auto" />
      <p class="font-medium text-default">Пока нет отчётов</p>
      <p class="text-sm text-muted max-w-md mx-auto">
        Отчёт и ретроспектива формируются по активным и закрытым спринтам.
        Запустите спринт на доске, и он появится здесь.
      </p>
    </div>

    <div v-else class="space-y-8">
      <section v-for="g in groups" :key="g.boardId" class="space-y-2">
        <div class="flex items-center justify-between gap-3">
          <h2 class="m-0 font-semibold text-default">{{ g.boardName }}</h2>
          <NuxtLink
            :to="pageRoutes.boardSprints(wsId, g.boardId)"
            class="shrink-0 text-[12px] text-muted transition-colors hover:text-accent-600"
          >
            К доске
          </NuxtLink>
        </div>

        <div class="surface-soft overflow-hidden rounded-2xl">
          <div
            class="hidden items-center gap-4 px-5 py-2.5 text-[11px] font-semibold uppercase tracking-[0.05em] text-muted sm:flex"
          >
            <span class="min-w-0 flex-1">Спринт</span>
            <span class="w-40 shrink-0">Период</span>
            <span class="w-28 shrink-0 text-right">Доставлено</span>
            <span class="w-36 shrink-0 text-right">Цель</span>
          </div>

          <NuxtLink
            v-for="s in [...g.active, ...g.closed]"
            :key="s.id"
            :to="reportPath(s)"
            class="flex flex-col gap-1 border-t border-default/60 px-5 py-3 transition-colors hover:bg-elevated sm:flex-row sm:items-center sm:gap-4"
          >
            <span class="flex min-w-0 flex-1 items-center gap-2">
              <span class="truncate font-medium text-default">{{ s.name }}</span>
              <span
                class="inline-flex h-[20px] shrink-0 items-center gap-1.5 rounded-full px-2 text-[10.5px] font-semibold uppercase tracking-[0.04em]"
                :class="SPRINT_STATE_BADGE[s.state]"
              >
                <span class="size-1.5 rounded-full" :class="SPRINT_STATE_DOT[s.state]" />
                {{ SPRINT_STATE_LABEL[s.state] }}
              </span>
            </span>

            <span class="w-40 shrink-0 text-[12px] tabular-nums text-muted">
              {{ formatDate(s.plannedStartAt) }} → {{ formatDate(s.plannedEndAt) }}
            </span>

            <span class="w-28 shrink-0 text-[13px] tabular-nums sm:text-right">
              <template v-if="s.outcome">
                <b class="text-default">{{ s.outcome.deliveredCount }}</b>
                <span class="text-muted"> из {{ s.outcome.startCount }}</span>
              </template>
              <span v-else class="text-dimmed">—</span>
            </span>

            <span class="w-36 shrink-0 text-[12px] sm:text-right">
              <template v-if="s.outcome?.goalAchieved === true">
                <span class="text-success-600">Достигнута</span>
              </template>
              <template v-else-if="s.outcome?.goalAchieved === false">
                <span class="text-error-600">Не достигнута</span>
              </template>
              <template v-else-if="s.state === 'active'">
                <span class="text-muted">Спринт идёт</span>
              </template>
              <template v-else-if="!s.outcome">
                <span class="text-dimmed">Отчёт не сформирован</span>
              </template>
              <template v-else>
                <span class="text-dimmed">Не фиксировалась</span>
              </template>
            </span>
          </NuxtLink>
        </div>
      </section>
    </div>
  </div>
</template>
