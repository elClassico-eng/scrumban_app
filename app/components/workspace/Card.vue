<script setup lang="ts">
import type { WorkspaceListItem } from '#shared/types/workspace'
import { pageRoutes } from '~/routing'

const props = defineProps<{ workspace: WorkspaceListItem }>()
const emit = defineEmits<{
  select: []
  rename: []
  label: []
  delete: []
}>()

const canRename = computed(() => hasRole(props.workspace.role, 'admin'))
const canDelete = computed(() => props.workspace.role === 'owner')

const menuItems = computed(() => {
  const base = [
    {
      label: 'Переименовать',
      icon: 'i-lucide-pencil',
      disabled: !canRename.value,
      onSelect: () => emit('rename'),
    },
    {
      label: props.workspace.myLabel ? `Ярлык: ${props.workspace.myLabel}` : 'Добавить ярлык',
      icon: 'i-lucide-tag',
      onSelect: () => emit('label'),
    },
  ]
  return canDelete.value
    ? [
        ...base,
        {
          label: 'Удалить',
          icon: 'i-lucide-trash-2',
          color: 'error' as const,
          onSelect: () => emit('delete'),
        },
      ]
    : base
})
</script>

<template>
  <NuxtLink
    :to="pageRoutes.boards(workspace.id)"
    class="group surface rounded-2xl p-5 flex flex-col justify-between gap-4 transition-all hover:shadow-md hover:border-accent-300"
    @click="emit('select')"
  >
    <div class="space-y-2">
      <div class="flex items-start justify-between gap-2">
        <h2 class="text-lg font-semibold tracking-tight truncate text-default">
          {{ workspace.name }}
        </h2>
        <div class="flex items-center gap-1 shrink-0" @click.prevent.stop>
          <WorkspaceMemberRoleBadge :role="workspace.role" />
          <UDropdownMenu :items="menuItems" :ui="{ content: 'w-48' }">
            <button
              type="button"
              class="size-7 rounded-md grid place-items-center text-muted hover:bg-zinc-100 hover:text-default transition-colors cursor-pointer"
              title="Действия"
            >
              <UIcon name="i-lucide-more-horizontal" class="size-4" />
            </button>
          </UDropdownMenu>
        </div>
      </div>

      <span
        v-if="workspace.myLabel"
        class="inline-flex items-center gap-1 text-[11px] font-medium text-accent-700 bg-accent-50 px-1.5 py-0.5 rounded"
      >
        <UIcon name="i-lucide-tag" class="size-3" />
        {{ workspace.myLabel }}
      </span>

      <p v-if="workspace.description" class="text-xs text-muted leading-relaxed line-clamp-2">
        {{ workspace.description }}
      </p>
      <p v-else-if="workspace.purpose" class="text-xs text-muted leading-relaxed line-clamp-2">
        {{ workspace.purpose }}
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
</template>