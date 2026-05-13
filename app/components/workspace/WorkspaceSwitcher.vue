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
  <div class="px-3 pb-2">
    <UDropdownMenu :items="items" :ui="{ content: 'w-56' }">
      <button
        type="button"
        class="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-[#f4f4f4] hover:bg-[#ebebeb] transition-colors text-left"
      >
        <UIcon name="i-lucide-folder" class="size-4 shrink-0 text-muted" />
        <span class="flex-1 truncate text-sm font-medium text-default">
          {{ current?.name ?? 'Выбрать workspace' }}
        </span>
        <UIcon name="i-lucide-chevrons-up-down" class="size-4 shrink-0 text-muted" />
      </button>
    </UDropdownMenu>
    <WorkspaceCreateModal v-model:open="createOpen" />
  </div>
</template>