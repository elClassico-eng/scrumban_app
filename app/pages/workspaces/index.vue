<script setup lang="ts">
import { pageRoutes } from '~/routing'

useHead({ title: 'Воркспейсы — Scrumban' })

const { list } = useWorkspacesApi()
const workspaceStore = useWorkspaceStore()

const workspaces = computed(() => list.data.value?.workspaces ?? [])
const isEmpty = computed(() => !list.isLoading.value && workspaces.value.length === 0)

const createOpen = ref(false)

function selectWorkspace(id: string) {
  workspaceStore.setCurrent(id)
}
</script>

<template>
  <div class="space-y-6 max-w-5xl">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Воркспейсы</h1>
        <p class="text-sm text-muted mt-1">Выбери workspace или создай новый</p>
      </div>
      <UButton icon="i-lucide-plus" @click="createOpen = true">
        Создать workspace
      </UButton>
    </div>

    <div v-if="list.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <UCard v-else-if="isEmpty" class="text-center py-12">
      <div class="space-y-3">
        <UIcon name="i-lucide-folder-plus" class="size-12 text-muted mx-auto" />
        <div>
          <p class="font-medium">У тебя пока нет воркспейсов</p>
          <p class="text-sm text-muted mt-1">Создай первый, чтобы начать</p>
        </div>
        <UButton icon="i-lucide-plus" @click="createOpen = true">
          Создать workspace
        </UButton>
      </div>
    </UCard>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink
        v-for="ws in workspaces"
        :key="ws.id"
        :to="pageRoutes.boards(ws.id)"
        class="block"
        @click="selectWorkspace(ws.id)"
      >
        <UCard class="hover:border-primary/50 transition-colors h-full">
          <div class="space-y-3">
            <div class="flex items-start justify-between gap-2">
              <h2 class="font-semibold truncate">{{ ws.name }}</h2>
              <WorkspaceMemberRoleBadge :role="ws.role" />
            </div>
            <p class="text-xs text-muted font-mono">{{ ws.slug }}</p>
          </div>
        </UCard>
      </NuxtLink>
    </div>

    <WorkspaceCreateModal v-model:open="createOpen" />
  </div>
</template>