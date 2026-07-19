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
      <section v-for="g in groups" :key="g.boardId" class="space-y-3">
        <div class="flex items-center gap-2.5">
          <UIcon name="i-lucide-layout-dashboard" class="size-4 text-accent-500" />
          <h2 class="text-[13px] font-bold uppercase tracking-[0.09em] text-default m-0">{{ g.boardName }}</h2>
          <span class="flex-1 h-px bg-default" />
          <NuxtLink
            :to="pageRoutes.boardSprints(wsId, g.boardId)"
            class="text-[12px] text-muted hover:text-accent-600 transition-colors shrink-0"
          >
            К доске
          </NuxtLink>
        </div>

        <ul class="space-y-2 m-0 p-0 list-none">
          <li v-for="s in [...g.active, ...g.closed]" :key="s.id">
            <div class="flex items-center gap-3 rounded-xl border border-default bg-default px-4 py-3">
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="font-medium text-default truncate">{{ s.name }}</span>
                  <span
                    class="inline-flex items-center gap-1.5 h-[20px] px-2 rounded-full text-[10.5px] font-semibold uppercase tracking-[0.04em] shrink-0"
                    :class="SPRINT_STATE_BADGE[s.state]"
                  >
                    <span class="size-1.5 rounded-full" :class="SPRINT_STATE_DOT[s.state]" />
                    {{ SPRINT_STATE_LABEL[s.state] }}
                  </span>
                </div>
                <p v-if="s.goal?.trim()" class="text-[12.5px] text-muted truncate mt-0.5">{{ s.goal }}</p>
                <div class="flex items-center gap-1.5 text-[12px] text-muted mt-1">
                  <UIcon name="i-lucide-calendar" class="size-3.5 shrink-0" />
                  <span class="tabular-nums">{{ formatDate(s.plannedStartAt) }} → {{ formatDate(s.plannedEndAt) }}</span>
                  <template v-if="s.state === 'closed' && s.endedAt">
                    <span class="text-dimmed">·</span>
                    <span>закрыт {{ formatDate(s.endedAt) }}</span>
                  </template>
                </div>
              </div>

              <div class="shrink-0 flex items-center gap-1.5">
                <UButton
                  size="xs"
                  variant="soft"
                  color="neutral"
                  icon="i-lucide-file-bar-chart-2"
                  :to="reportPath(s)"
                >
                  Отчёт
                </UButton>
                <UButton
                  size="xs"
                  variant="ghost"
                  color="neutral"
                  icon="i-lucide-messages-square"
                  :to="`${reportPath(s)}?tab=retro`"
                >
                  Ретро
                </UButton>
              </div>
            </div>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
