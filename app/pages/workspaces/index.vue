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

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <NuxtLink
        v-for="ws in workspaces"
        :key="ws.id"
        :to="pageRoutes.boards(ws.id)"
        class="group surface rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-md hover:border-accent-300"
        @click="selectWorkspace(ws.id)"
      >
        <div class="space-y-2">
          <div class="flex items-start justify-between gap-2">
            <h2 class="text-lg font-semibold tracking-tight truncate text-default">
              {{ ws.name }}
            </h2>
            <WorkspaceMemberRoleBadge :role="ws.role" />
          </div>
          <p
            v-if="ws.description"
            class="text-xs text-muted leading-relaxed line-clamp-2"
          >
            {{ ws.description }}
          </p>
          <p
            v-else-if="ws.purpose"
            class="text-xs text-muted leading-relaxed line-clamp-2"
          >
            {{ ws.purpose }}
          </p>
          <p v-else class="text-xs text-muted italic">
            Без описания
          </p>
        </div>

        <div class="inline-flex items-center gap-1.5 text-xs font-medium text-default group-hover:text-accent-600 border-b border-current pb-0.5 w-fit transition-all group-hover:translate-x-1">
          Открыть
          <UIcon name="i-lucide-arrow-right" class="size-3.5" />
        </div>
      </NuxtLink>
    </div>

    <WorkspaceCreateModal v-model:open="createOpen" />
  </div>
</template>