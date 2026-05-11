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
  <div class="px-3 py-2">
    <UDropdownMenu :items="items" :ui="{ content: 'w-56' }">
      <UButton variant="soft" color="neutral" block class="justify-between" trailing-icon="i-lucide-chevrons-up-down">
        <span class="truncate text-left flex-1">
          {{ current?.name ?? 'Выбрать workspace' }}
        </span>
      </UButton>
    </UDropdownMenu>
    <WorkspaceCreateModal v-model:open="createOpen" />
  </div>
</template>