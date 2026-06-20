<script setup lang="ts">
import type { MemberView } from '#shared/types/workspace'
import type { CalendarFilters } from '~/utils/calendar'

const props = defineProps<{
  members: MemberView[]
  modelValue: CalendarFilters
}>()

const emit = defineEmits<{
  'update:modelValue': [value: CalendarFilters]
}>()

const selectedCount = computed(() => props.modelValue.assigneeIds.length)
const label = computed(() => {
  if (props.modelValue.mine) return 'Мои'
  return selectedCount.value === 0 ? 'Все' : `${selectedCount.value} выбрано`
})
const isFiltered = computed(() => props.modelValue.mine || selectedCount.value > 0)

function setMine(v: boolean) {
  emit('update:modelValue', { ...props.modelValue, mine: v })
}

function toggleAssignee(userId: string) {
  const set = new Set(props.modelValue.assigneeIds)
  if (set.has(userId)) set.delete(userId)
  else set.add(userId)
  emit('update:modelValue', { ...props.modelValue, assigneeIds: [...set] })
}

function clear() {
  emit('update:modelValue', { mine: false, assigneeIds: [] })
}
</script>

<template>
  <UPopover>
    <UButton
      variant="outline"
      color="neutral"
      size="sm"
      icon="i-lucide-users"
      trailing-icon="i-lucide-chevron-down"
      :class="isFiltered ? 'ring-1 ring-accent-500/40' : ''"
    >
      {{ label }}
    </UButton>

    <template #content>
      <div class="p-2 w-64 flex flex-col">
        <div class="flex items-center justify-between gap-2 px-2 py-1.5">
          <span class="text-sm font-medium">Только мои</span>
          <USwitch :model-value="modelValue.mine" @update:model-value="setMine" />
        </div>

        <USeparator class="my-1" />

        <div class="max-h-64 overflow-y-auto flex flex-col">
          <button
            v-for="m in members"
            :key="m.userId"
            type="button"
            class="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-elevated text-left transition-colors"
            @click="toggleAssignee(m.userId)"
          >
            <UCheckbox
              :model-value="modelValue.assigneeIds.includes(m.userId)"
              class="pointer-events-none"
              tabindex="-1"
            />
            <UAvatar
              :src="m.avatarUrl ?? undefined"
              :alt="displayName(m)"
              :text="initials(m)"
              size="2xs"
            />
            <span class="text-sm truncate flex-1">{{ displayName(m) }}</span>
          </button>
        </div>

        <template v-if="isFiltered">
          <USeparator class="my-1" />
          <button
            type="button"
            class="text-xs text-muted hover:text-accent-600 px-2 py-1 text-left transition-colors"
            @click="clear"
          >
            Сбросить фильтры
          </button>
        </template>
      </div>
    </template>
  </UPopover>
</template>
