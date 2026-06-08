<script setup lang="ts">
import { useLocalStorage } from '@vueuse/core'
import type { WorkspaceListItem } from '#shared/types/workspace'

useHead({ title: 'Воркспейсы — Scrumban' })

const { list, update, remove, setLabel } = useWorkspacesApi()
const workspaceStore = useWorkspaceStore()
const toast = useToast()

const workspaces = computed(() => list.data.value?.workspaces ?? [])
const isEmpty = computed(() => !list.isLoading.value && workspaces.value.length === 0)

const createOpen = ref(false)
const renameTarget = ref<WorkspaceListItem | null>(null)
const labelTarget = ref<WorkspaceListItem | null>(null)
const deleteTarget = ref<WorkspaceListItem | null>(null)

const renameOpen = computed({
  get: () => renameTarget.value !== null,
  set: (v) => { if (!v) renameTarget.value = null },
})
const labelOpen = computed({
  get: () => labelTarget.value !== null,
  set: (v) => { if (!v) labelTarget.value = null },
})
const deleteOpen = computed({
  get: () => deleteTarget.value !== null,
  set: (v) => { if (!v) deleteTarget.value = null },
})

function selectWorkspace(id: string) {
  workspaceStore.setCurrent(id)
}

type Group = { key: string; label: string; items: WorkspaceListItem[] }

const groups = computed<Group[]>(() => {
  const byLabel = new Map<string, WorkspaceListItem[]>()
  const unlabeled: WorkspaceListItem[] = []
  for (const w of workspaces.value) {
    if (w.myLabel) byLabel.set(w.myLabel, [...(byLabel.get(w.myLabel) ?? []), w])
    else unlabeled.push(w)
  }
  const labeled = [...byLabel.entries()]
    .sort(([a], [b]) => a.localeCompare(b, 'ru'))
    .map(([label, items]) => ({ key: label, label, items }))
  if (unlabeled.length) labeled.push({ key: '__none__', label: 'Без категории', items: unlabeled })
  return labeled
})

const labels = computed(() => groups.value.filter(g => g.key !== '__none__').map(g => g.label))
const grouped = computed(() => labels.value.length > 0)

const activeFilter = ref<string | null>(null)
const visibleGroups = computed(() =>
  activeFilter.value === null
    ? groups.value
    : groups.value.filter(g => g.label === activeFilter.value),
)

const collapsed = useLocalStorage<string[]>('scrumban:ws-collapsed', [])
function toggleGroup(key: string) {
  collapsed.value = collapsed.value.includes(key)
    ? collapsed.value.filter(k => k !== key)
    : [...collapsed.value, key]
}
const isCollapsed = (key: string) => collapsed.value.includes(key)

async function onRename(name: string) {
  if (!renameTarget.value) return
  try {
    await update.mutateAsync({ workspaceId: renameTarget.value.id, name })
    renameTarget.value = null
  }
  catch {
    toast.add({ title: 'Не удалось переименовать', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

async function onSetLabel(label: string | null) {
  if (!labelTarget.value) return
  try {
    await setLabel.mutateAsync({ workspaceId: labelTarget.value.id, label })
    labelTarget.value = null
  }
  catch {
    toast.add({ title: 'Не удалось обновить ярлык', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

async function onDelete() {
  if (!deleteTarget.value) return
  try {
    await remove.mutateAsync(deleteTarget.value.id)
    toast.add({ title: 'Workspace удалён', color: 'accent', icon: 'i-lucide-check' })
    deleteTarget.value = null
  }
  catch {
    toast.add({ title: 'Не удалось удалить', color: 'error', icon: 'i-lucide-alert-circle' })
  }
}
</script>

<template>
  <div class="space-y-6">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-3xl font-bold tracking-tight">Воркспейсы</h1>
        <p class="text-sm text-muted mt-1">Выберите команду или создайте новую</p>
      </div>
      <UButton icon="i-lucide-plus" size="lg" class="py-2.5" @click="createOpen = true">
        Создать workspace
      </UButton>
    </div>

    <WorkspaceMyInvitationsSection />

    <div v-if="list.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div
      v-else-if="isEmpty"
      class="text-center py-16 space-y-3 rounded-3xl border border-dashed border-default"
    >
      <UIcon name="i-lucide-folder-plus" class="size-12 text-muted mx-auto" />
      <p class="font-medium">У вас пока нет воркспейсов</p>
      <p class="text-sm text-muted">Создайте первый, чтобы начать</p>
      <UButton icon="i-lucide-plus" size="lg" @click="createOpen = true">
        Создать workspace
      </UButton>
    </div>

    <template v-else-if="grouped">
      <div class="flex flex-wrap gap-1.5">
        <button
          type="button"
          class="text-[12px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer"
          :class="activeFilter === null
            ? 'border-accent-400 text-accent-700 dark:text-accent-300 bg-accent-50 dark:bg-accent-950'
            : 'border-default text-muted hover:border-accent-300'"
          @click="activeFilter = null"
        >
          Все
        </button>
        <button
          v-for="l in labels"
          :key="l"
          type="button"
          class="text-[12px] px-2.5 py-1 rounded-full border transition-colors cursor-pointer"
          :class="activeFilter === l
            ? 'border-accent-400 text-accent-700 dark:text-accent-300 bg-accent-50 dark:bg-accent-950'
            : 'border-default text-muted hover:border-accent-300'"
          @click="activeFilter = l"
        >
          {{ l }}
        </button>
      </div>

      <section v-for="g in visibleGroups" :key="g.key" class="space-y-3">
        <button
          type="button"
          class="flex items-center gap-2 w-full text-left cursor-pointer group"
          @click="toggleGroup(g.key)"
        >
          <UIcon
            name="i-lucide-chevron-down"
            class="size-4 text-muted transition-transform"
            :class="isCollapsed(g.key) ? '-rotate-90' : ''"
          />
          <h2 class="text-[12px] font-bold uppercase tracking-[0.08em] text-muted m-0">
            {{ g.label }}
          </h2>
          <span class="text-[11px] font-medium text-muted bg-elevated px-1.5 py-0.5 rounded-full">
            {{ g.items.length }}
          </span>
          <span class="flex-1 h-px bg-accented" />
        </button>

        <div
          v-show="!isCollapsed(g.key)"
          class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
        >
          <WorkspaceCard
            v-for="ws in g.items"
            :key="ws.id"
            :workspace="ws"
            @select="selectWorkspace(ws.id)"
            @rename="renameTarget = ws"
            @label="labelTarget = ws"
            @delete="deleteTarget = ws"
          />
        </div>
      </section>
    </template>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <WorkspaceCard
        v-for="ws in workspaces"
        :key="ws.id"
        :workspace="ws"
        @select="selectWorkspace(ws.id)"
        @rename="renameTarget = ws"
        @label="labelTarget = ws"
        @delete="deleteTarget = ws"
      />
    </div>

    <WorkspaceCreateModal v-model:open="createOpen" />

    <CommonRenameModal
      v-if="renameTarget"
      v-model:open="renameOpen"
      entity-label="workspace"
      :current-name="renameTarget.name"
      :loading="update.isPending.value"
      @submit="onRename"
    />
    <WorkspaceLabelModal
      v-if="labelTarget"
      v-model:open="labelOpen"
      :workspace-name="labelTarget.name"
      :current-label="labelTarget.myLabel"
      :suggestions="labels"
      :loading="setLabel.isPending.value"
      @submit="onSetLabel"
    />
    <WorkspaceDeleteModal
      v-if="deleteTarget"
      v-model:open="deleteOpen"
      :workspace-name="deleteTarget.name"
      :loading="remove.isPending.value"
      @confirm="onDelete"
    />
  </div>
</template>