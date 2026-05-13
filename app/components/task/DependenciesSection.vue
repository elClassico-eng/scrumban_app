<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  workspaceId: string
  boardId: string
  taskId: string
  boardTasks: Task[]
  columns: BoardColumn[]
}>()

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const tId = computed(() => props.taskId)

const { list, add, remove } = useTaskDependenciesApi(wsId, bId, tId)
const toast = useToast()

const blockers = computed(() => list.data.value?.blockers ?? [])
const blocks = computed(() => list.data.value?.blocks ?? [])

const linkedIds = computed(() => {
  const ids = new Set<string>([props.taskId])
  for (const d of blockers.value) ids.add(d.blockerTaskId)
  for (const d of blocks.value) ids.add(d.blockedTaskId)
  return ids
})

const pickerOpen = ref(false)

async function onPick(blockerTaskId: string) {
  try {
    await add.mutateAsync(blockerTaskId)
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось добавить зависимость'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function onRemove(blockerTaskId: string) {
  try {
    await remove.mutateAsync(blockerTaskId)
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось удалить зависимость'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

</script>

<template>
  <div class="space-y-3">
    <div class="flex items-center justify-between">
      <p class="text-xs text-muted uppercase tracking-wide">Зависимости</p>
      <UButton
        icon="i-lucide-plus"
        size="xs"
        variant="ghost"
        color="neutral"
        @click="pickerOpen = true"
      >
        Добавить блокера
      </UButton>
    </div>

    <div class="space-y-1.5">
      <p class="text-[11px] text-muted uppercase tracking-wide">Блокируется задачами</p>
      <div
        v-for="dep in blockers"
        :key="dep.blockerTaskId"
        class="flex items-center gap-2 px-2 py-1.5 rounded bg-elevated"
      >
        <UIcon name="i-lucide-lock" class="size-3.5 text-warning shrink-0" />
        <NuxtLink
          :to="pageRoutes.task(workspaceId, boardId, dep.blockerTaskId)"
          class="text-sm flex-1 text-left truncate hover:text-primary"
        >
          {{ dep.blockerTitle }}
        </NuxtLink>
        <UButton
          icon="i-lucide-x"
          size="xs"
          variant="ghost"
          color="neutral"
          @click="onRemove(dep.blockerTaskId)"
        />
      </div>
      <p v-if="blockers.length === 0" class="text-xs text-muted px-2 py-1.5">
        Никто не блокирует эту задачу.
      </p>
    </div>

    <div class="space-y-1.5">
      <p class="text-[11px] text-muted uppercase tracking-wide">Блокирует задачи</p>
      <div
        v-for="dep in blocks"
        :key="dep.blockedTaskId"
        class="flex items-center gap-2 px-2 py-1.5 rounded bg-elevated"
      >
        <UIcon name="i-lucide-link" class="size-3.5 text-muted shrink-0" />
        <NuxtLink
          :to="pageRoutes.task(workspaceId, boardId, dep.blockedTaskId)"
          class="text-sm flex-1 text-left truncate hover:text-primary"
        >
          {{ dep.blockedTitle }}
        </NuxtLink>
      </div>
      <p v-if="blocks.length === 0" class="text-xs text-muted px-2 py-1.5">
        Эта задача никого не блокирует.
      </p>
    </div>

    <TaskPickerModal
      v-model:open="pickerOpen"
      :tasks="boardTasks"
      :columns="columns"
      :exclude-ids="Array.from(linkedIds)"
      title="Выбрать задачу-блокера"
      placeholder="Найди задачу-блокера..."
      @select="onPick"
    />
  </div>
</template>