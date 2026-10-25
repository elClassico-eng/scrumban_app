<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { MemberView } from '#shared/types/workspace'
import type { RetroNote } from '~/composables/api/useSprintRetroApi'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  note: RetroNote
  members: MemberView[]
  canWrite: boolean
  canManage: boolean
  converting: boolean
  wsId: string
  boardId: string
}>()
const emit = defineEmits<{
  patch: [patch: { isResolved?: boolean, assigneeId?: string | null, dueDate?: string | null, body?: string }]
  convert: []
  remove: []
}>()

const assignee = computed(() => props.members.find(m => m.userId === props.note.assigneeId) ?? null)
const dueDay = computed(() => props.note.dueDate?.slice(0, 10) ?? '')

const assigneeItems = computed<DropdownMenuItem[][]>(() => [
  props.members.map(m => ({
    label: displayName(m),
    avatar: m.avatarUrl ? { src: m.avatarUrl } : { text: initials(m) },
    onSelect: () => emit('patch', { assigneeId: m.userId }),
  })),
  ...(props.note.assigneeId ? [[{ label: 'Без ответственного', icon: 'i-hugeicons-cancel-01', onSelect: () => emit('patch', { assigneeId: null }) }]] : []),
])

function onDue(value: string) {
  emit('patch', { dueDate: value ? new Date(`${value}T23:59:59Z`).toISOString() : null })
}

const editing = ref(false)
const draft = ref('')

function save() {
  const body = draft.value.trim()
  if (body) emit('patch', { body })
  editing.value = false
}
</script>

<template>
  <li class="group flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-3">
    <UCheckbox
      :model-value="note.isResolved"
      :disabled="!canWrite"
      aria-label="Выполнено"
      @update:model-value="emit('patch', { isResolved: Boolean($event) })"
    />
    <UInput
      v-if="editing"
      v-model="draft"
      size="sm"
      autofocus
      class="min-w-48 flex-1"
      @keydown.enter.prevent="save"
      @keydown.esc="editing = false"
      @blur="save"
    />
    <p
      v-else
      :class="['m-0 min-w-48 flex-1 text-[13.5px]', note.isResolved ? 'text-muted line-through' : 'text-default']"
      @dblclick="canManage && (draft = note.body, editing = true)"
    >
      {{ note.body }}
    </p>

    <UDropdownMenu :items="assigneeItems" :disabled="!canWrite" :ui="{ content: 'w-60 max-h-72' }">
      <button
        type="button"
        :class="['inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px] transition-colors', canWrite ? 'cursor-pointer hover:bg-elevated' : '', assignee ? 'text-default' : 'text-dimmed']"
      >
        <UserAvatar v-if="assignee" :user="assignee" size="xs" />
        <UIcon v-else name="i-hugeicons-user" class="size-3.5" />
        {{ assignee ? displayName(assignee) : 'Ответственный' }}
      </button>
    </UDropdownMenu>

    <label :class="['inline-flex h-7 items-center gap-1.5 rounded-lg px-2 text-[12px]', dueDay ? 'text-default' : 'text-dimmed', canWrite ? 'hover:bg-elevated' : '']">
      <input
        type="date"
        :value="dueDay"
        :disabled="!canWrite"
        class="w-[7.5rem] cursor-pointer bg-transparent outline-none disabled:cursor-default"
        aria-label="Срок"
        @change="onDue(($event.target as HTMLInputElement).value)"
      >
    </label>

    <NuxtLink
      v-if="note.convertedTaskId"
      :to="pageRoutes.task(wsId, boardId, note.convertedTaskId)"
      class="inline-flex h-7 items-center gap-1 rounded-lg bg-emerald-500/10 px-2 text-[12px] font-medium text-emerald-700 dark:text-emerald-300"
    >
      <UIcon name="i-hugeicons-task-done-01" class="size-3.5" />
      Задача
    </NuxtLink>
    <UButton
      v-else-if="canWrite"
      size="xs"
      variant="outline"
      color="neutral"
      icon="i-hugeicons-arrow-right-02"
      :loading="converting"
      @click="emit('convert')"
    >
      В задачу
    </UButton>

    <UDropdownMenu
      v-if="canManage"
      :items="[[
        { label: 'Изменить', icon: 'i-hugeicons-pencil-edit-02', onSelect: () => { draft = note.body; editing = true } },
        { label: 'Удалить', icon: 'i-hugeicons-delete-02', color: 'error', onSelect: () => emit('remove') },
      ]]"
    >
      <button type="button" class="grid size-7 place-items-center rounded-md text-dimmed opacity-0 transition-opacity hover:bg-elevated hover:text-default group-hover:opacity-100 focus-visible:opacity-100 data-[state=open]:opacity-100" aria-label="Действия">
        <UIcon name="i-hugeicons-more-horizontal" class="size-3.5" />
      </button>
    </UDropdownMenu>
  </li>
</template>
