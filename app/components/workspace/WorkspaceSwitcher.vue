<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { pageRoutes } from '~/routing'
import { ROLE_LABEL } from '~/utils/role-labels'

defineProps<{ collapsed: boolean }>()
const emit = defineEmits<{ invite: [], customize: [] }>()

const workspaceStore = useWorkspaceStore()
const { current, workspaces } = useCurrentWorkspace()
const router = useRouter()

const createOpen = ref(false)
const canManage = computed(() => hasRole(current.value?.role, 'admin'))

function selectWorkspace(id: string) {
  workspaceStore.setCurrent(id)
  router.push(pageRoutes.boards(id))
}

const items = computed<DropdownMenuItem[][]>(() => {
  const ws = current.value
  const switcher: DropdownMenuItem[] = [
    { type: 'label', label: 'Воркспейсы' },
    ...workspaces.value.map(w => ({
      label: w.name,
      description: ROLE_LABEL[w.role],
      avatar: w.logoUrl
        ? { src: w.logoUrl, alt: w.name, size: 'sm' as const }
        : { text: w.name.trim().charAt(0).toUpperCase(), size: 'sm' as const },
      current: w.id === ws?.id,
      onSelect: () => selectWorkspace(w.id),
    })),
    { label: 'Все workspaces', icon: 'i-hugeicons-layout-grid', to: pageRoutes.workspaces },
    { label: 'Создать workspace', icon: 'i-hugeicons-plus', onSelect: () => { createOpen.value = true } },
  ]
  const manage: DropdownMenuItem[] = ws
    ? [
        { type: 'label', label: ws.name },
        { label: 'Участники', icon: 'i-hugeicons-user-group', to: pageRoutes.workspaceMembers(ws.id) },
        ...(canManage.value
          ? [
              { label: 'Пригласить', icon: 'i-hugeicons-user-add-01', onSelect: () => emit('invite') },
              { label: 'Настройки воркспейса', icon: 'i-hugeicons-settings-01', to: pageRoutes.settings('team') },
            ]
          : []),
      ]
    : []
  const personal: DropdownMenuItem[] = [
    { type: 'label', label: 'Вид' },
    { label: 'Настроить сайдбар', icon: 'i-hugeicons-sliders-horizontal', onSelect: () => emit('customize') },
  ]
  return [switcher, manage, personal].filter(group => group.length)
})
</script>

<template>
  <div :class="collapsed ? 'flex justify-center pb-2' : 'px-3 pt-1 pb-2'">
    <UDropdownMenu :items="items" :content="{ side: collapsed ? 'right' : 'bottom', align: 'start' }" :ui="{ content: 'w-64' }">
      <button
        v-if="collapsed"
        type="button"
        class="cursor-pointer rounded-xl"
        :title="current?.name ?? 'Воркспейс'"
        aria-label="Меню воркспейса"
      >
        <WorkspaceAvatar :name="current?.name ?? ''" :logo-url="current?.logoUrl" size="md" />
      </button>
      <button
        v-else
        type="button"
        class="group flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-default bg-default px-2.5 py-2 text-left shadow-xs transition-colors hover:border-[var(--ui-border-accented)] hover:bg-elevated data-[state=open]:border-[var(--ui-border-accented)] data-[state=open]:bg-elevated"
        aria-label="Меню воркспейса"
      >
        <WorkspaceAvatar :name="current?.name ?? ''" :logo-url="current?.logoUrl" size="sm" />
        <span class="min-w-0 flex-1">
          <span class="block truncate text-sm font-semibold text-highlighted">
            {{ current?.name ?? 'Выбрать workspace' }}
          </span>
          <span v-if="current" class="block truncate text-xs text-dimmed">{{ ROLE_LABEL[current.role] }}</span>
        </span>
        <span class="grid size-6 shrink-0 place-items-center rounded-md bg-elevated text-muted transition-colors group-hover:bg-accented group-hover:text-default group-data-[state=open]:bg-accented">
          <UIcon name="i-hugeicons-arrow-down-01" class="size-3.5 transition-transform duration-200 group-data-[state=open]:rotate-180" />
        </span>
      </button>
      <template #item-trailing="{ item }">
        <UIcon v-if="item.current" name="i-hugeicons-check" class="size-4 text-accent-600 dark:text-accent-400" />
      </template>
    </UDropdownMenu>
    <WorkspaceCreateModal v-model:open="createOpen" />
  </div>
</template>
