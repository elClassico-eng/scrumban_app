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

const isCover = computed(() => props.workspace.cardStyle === 'cover')
const initial = computed(() => props.workspace.name.slice(0, 1).toUpperCase() || '∗')
const description = computed(() => props.workspace.description || props.workspace.purpose || '')

const stats = computed(() => [
  {
    icon: 'i-lucide-layout-dashboard',
    value: props.workspace.boardCount,
    word: plural(props.workspace.boardCount, ['доска', 'доски', 'досок']),
  },
  {
    icon: 'i-lucide-list-todo',
    value: props.workspace.openTaskCount,
    word: plural(props.workspace.openTaskCount, ['задача', 'задачи', 'задач']),
  },
  {
    icon: 'i-lucide-users',
    value: props.workspace.memberCount,
    word: plural(props.workspace.memberCount, ['участник', 'участника', 'участников']),
  },
])

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
    v-if="isCover"
    :to="pageRoutes.workspace(workspace.id)"
    class="group surface relative flex min-h-[240px] flex-col overflow-hidden rounded-2xl transition-all hover:shadow-md hover:border-accent-300"
    @click="emit('select')"
  >
    <img
      v-if="workspace.logoUrl"
      :src="workspace.logoUrl"
      alt=""
      class="absolute inset-0 size-full object-cover transition-transform duration-500 group-hover:scale-105"
    >
    <div v-else class="brand-gradient absolute inset-0">
      <div class="absolute inset-0 grid place-items-center">
        <span class="text-5xl font-bold text-white/90">{{ initial }}</span>
      </div>
    </div>

    <div class="absolute inset-0 bg-gradient-to-t from-black/90 via-black/45 to-black/10" />

    <div class="relative flex flex-1 flex-col p-5 text-white">
      <div class="flex items-start justify-end gap-1" @click.prevent.stop>
        <WorkspaceMemberRoleBadge :role="workspace.role" />
        <UDropdownMenu :items="menuItems" :ui="{ content: 'w-48' }">
          <button
            type="button"
            class="size-7 rounded-md grid place-items-center text-white/90 hover:bg-white/20 transition-colors cursor-pointer"
            title="Действия"
          >
            <UIcon name="i-lucide-more-horizontal" class="size-4" />
          </button>
        </UDropdownMenu>
      </div>

      <div class="mt-auto space-y-2">
        <div class="space-y-1">
          <h2 class="text-lg font-semibold tracking-tight truncate drop-shadow">{{ workspace.name }}</h2>
          <span
            v-if="workspace.myLabel"
            class="inline-flex items-center gap-1 text-[11px] font-medium text-white bg-white/20 backdrop-blur-md px-1.5 py-0.5 rounded"
          >
            <UIcon name="i-lucide-tag" class="size-3" />
            {{ workspace.myLabel }}
          </span>
          <p v-if="description" class="text-xs text-white/80 leading-relaxed line-clamp-1">{{ description }}</p>
        </div>

        <div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/80">
          <span v-for="s in stats" :key="s.icon" class="inline-flex items-center gap-1">
            <UIcon :name="s.icon" class="size-3.5" />
            <span class="font-medium text-white">{{ s.value }}</span>
            {{ s.word }}
          </span>
        </div>

        <div class="flex items-center justify-between border-t border-white/15 pt-2.5">
          <span class="text-[11px] text-white/60">{{ workspace.slug }}</span>
          <span class="inline-flex items-center gap-1.5 text-xs font-medium text-white transition-all group-hover:translate-x-0.5">
            Открыть
            <UIcon name="i-lucide-arrow-right" class="size-3.5" />
          </span>
        </div>
      </div>
    </div>
  </NuxtLink>

  <NuxtLink
    v-else
    :to="pageRoutes.workspace(workspace.id)"
    class="group surface rounded-2xl p-5 flex flex-col gap-4 transition-all hover:shadow-md hover:border-accent-300"
    @click="emit('select')"
  >
    <div class="flex items-start gap-3">
      <div class="size-11 shrink-0 rounded-xl overflow-hidden grid place-items-center text-base font-bold text-white brand-gradient">
        <img
          v-if="workspace.logoUrl"
          :src="workspace.logoUrl"
          alt=""
          class="size-full object-cover"
        >
        <span v-else>{{ initial }}</span>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-start justify-between gap-2">
          <h2 class="text-lg font-semibold tracking-tight truncate text-default">
            {{ workspace.name }}
          </h2>
          <div class="flex items-center gap-1 shrink-0" @click.prevent.stop>
            <WorkspaceMemberRoleBadge :role="workspace.role" />
            <UDropdownMenu :items="menuItems" :ui="{ content: 'w-48' }">
              <button
                type="button"
                class="size-7 rounded-md grid place-items-center text-muted hover:bg-elevated hover:text-default transition-colors cursor-pointer"
                title="Действия"
              >
                <UIcon name="i-lucide-more-horizontal" class="size-4" />
              </button>
            </UDropdownMenu>
          </div>
        </div>

        <span
          v-if="workspace.myLabel"
          class="mt-1 inline-flex items-center gap-1 text-[11px] font-medium text-accent-700 dark:text-accent-300 bg-accent-50 dark:bg-accent-950 px-1.5 py-0.5 rounded"
        >
          <UIcon name="i-lucide-tag" class="size-3" />
          {{ workspace.myLabel }}
        </span>
      </div>
    </div>

    <p v-if="description" class="text-xs text-muted leading-relaxed line-clamp-2">
      {{ description }}
    </p>
    <p v-else class="text-xs text-muted italic">
      Без описания
    </p>

    <div class="mt-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
      <span v-for="s in stats" :key="s.icon" class="inline-flex items-center gap-1">
        <UIcon :name="s.icon" class="size-3.5" />
        <span class="font-medium text-default">{{ s.value }}</span>
        {{ s.word }}
      </span>
    </div>

    <div class="flex items-center justify-between border-t border-default pt-3">
      <span class="text-[11px] text-muted">{{ workspace.slug }}</span>
      <span class="inline-flex items-center gap-1.5 text-xs font-medium text-default group-hover:text-accent-600 transition-all group-hover:translate-x-0.5">
        Открыть
        <UIcon name="i-lucide-arrow-right" class="size-3.5" />
      </span>
    </div>
  </NuxtLink>
</template>
