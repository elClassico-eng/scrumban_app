<script setup lang="ts">
import { pageRoutes } from '~/routing'

const workspaceStore = useWorkspaceStore()
const { list } = useWorkspacesApi()
const router = useRouter()

const workspaces = computed(() => list.data.value?.workspaces ?? [])

const current = computed(() => {
  const id = workspaceStore.currentId
  return workspaces.value.find(w => w.id === id) ?? workspaces.value[0] ?? null
})

const createOpen = ref(false)

function selectWorkspace(id: string) {
  workspaceStore.setCurrent(id)
  router.push(pageRoutes.boards(id))
}

const items = computed(() => [
  workspaces.value.map(w => ({
    label: w.name,
    icon: w.id === current.value?.id ? 'i-lucide-check' : 'i-lucide-folder',
    onSelect: () => selectWorkspace(w.id),
  })),
  [{
    label: 'Создать workspace',
    icon: 'i-lucide-plus',
    onSelect: () => { createOpen.value = true },
  }],
])
</script>

<template>
  <div class="px-3 pt-1 pb-1">
    <UDropdownMenu :items="items" :ui="{ content: 'w-56' }">
      <button
        type="button"
        class="group flex w-full items-center gap-2.5 rounded-xl border border-default bg-elevated px-2.5 py-2 text-left transition-colors hover:border-[var(--ui-border-accented)]"
      >
        <span class="grid size-7 shrink-0 place-items-center rounded-lg bg-default text-accent-600 dark:text-accent-400">
          <UIcon name="i-lucide-folder" class="size-4" />
        </span>
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold text-highlighted">
            {{ current?.name ?? 'Выбрать workspace' }}
          </span>
          <span class="block text-xs text-dimmed">Воркспейс</span>
        </span>
        <UIcon name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-dimmed" />
      </button>
    </UDropdownMenu>
    <WorkspaceCreateModal v-model:open="createOpen" />
  </div>
</template>