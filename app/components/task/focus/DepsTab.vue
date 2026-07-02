<script setup lang="ts">
import type { MaybeRef } from 'vue'
import type { Task } from '#shared/types/task'
import type { BoardColumn } from '#shared/types/column'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  workspaceId: string
  boardId: string
  taskId: string
  task: Task
  boardTasks: Task[]
  columns: BoardColumn[]
}>()

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const tId = computed(() => props.taskId)

const { list, add, remove } = useTaskDependenciesApi(wsId as MaybeRef<string>, bId as MaybeRef<string>, tId as MaybeRef<string>)
const { update } = useTasksApi(wsId, bId)
const toast = useToast()

const blockers = computed(() => list.data.value?.blockers ?? [])
const blocks = computed(() => list.data.value?.blocks ?? [])

const blockerPickerOpen = ref(false)
const dependencyPickerOpen = ref(false)

const excludeIds = computed(() => {
  const ids = new Set<string>([props.taskId])
  for (const d of blockers.value) ids.add(d.blockerTaskId)
  for (const d of blocks.value) ids.add(d.blockedTaskId)
  return Array.from(ids)
})

async function onAddBlocker(blockerTaskId: string) {
  try {
    await add.mutateAsync(blockerTaskId)
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось добавить блокера'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function onRemoveBlocker(blockerTaskId: string) {
  try {
    await remove.mutateAsync(blockerTaskId)
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось удалить блокера'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const blockedReasonDraft = ref(props.task.blockedReason ?? '')
const isEditingReason = ref(false)
watch(() => props.task.blockedReason, (v) => {
  if (!isEditingReason.value) blockedReasonDraft.value = v ?? ''
})

function startEditReason() {
  blockedReasonDraft.value = props.task.blockedReason ?? ''
  isEditingReason.value = true
}

async function commitEditReason() {
  isEditingReason.value = false
  const next = blockedReasonDraft.value.trim() || null
  if (next === (props.task.blockedReason ?? null)) return
  try {
    await update.mutateAsync({ taskId: props.taskId, blockedReason: next })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сохранить'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const columnNameMap = computed(() => {
  const m: Record<string, BoardColumn> = {}
  for (const c of props.columns) m[c.id] = c
  return m
})

function statusOf(taskId: string): { label: string; tone: 'done' | 'progress' | 'default' } {
  const t = props.boardTasks.find(x => x.id === taskId)
  if (!t) return { label: '—', tone: 'default' }
  const col = columnNameMap.value[t.columnId]
  if (!col) return { label: '—', tone: 'default' }
  const role = col.columnRole
  if (role === 'done') return { label: col.name, tone: 'done' }
  if (role === 'in_progress' || role === 'review') return { label: col.name, tone: 'progress' }
  return { label: col.name, tone: 'default' }
}
</script>

<template>
  <div class="space-y-7">
    <section v-if="task.blockedReason || blockers.length > 0">
      <div class="flex items-center gap-2 mb-2.5">
        <h4 class="text-[12px] font-semibold uppercase tracking-[0.06em] text-red-600 m-0">
          Блокеры
        </h4>
        <span
          v-if="blockers.length > 0 || task.blockedReason"
          class="h-5 px-1.5 rounded text-[11px] font-medium inline-flex items-center bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300"
        >
          {{ blockers.length + (task.blockedReason ? 1 : 0) }} активный
        </span>
        <div class="flex-1" />
        <button
          type="button"
          class="h-6 px-2 rounded-md border border-dashed border-default text-[12px] text-muted inline-flex items-center gap-1 cursor-pointer transition-colors hover:border-accent-500 hover:text-accent-500 hover:border-solid"
          @click="blockerPickerOpen = true"
        >
          <UIcon name="i-lucide-plus" class="size-3" />
          Сообщить о блокере
        </button>
      </div>

      <div
        v-for="dep in blockers"
        :key="dep.blockerTaskId"
        class="flex gap-3 p-3.5 rounded-lg border border-red-100 dark:border-red-900/40 mb-2 bg-red-50 dark:bg-red-950/40"
      >
        <div class="size-7 rounded-md bg-red-500 text-white grid place-items-center shrink-0">
          <UIcon name="i-lucide-alert-triangle" class="size-3.5" />
        </div>
        <div class="flex-1 min-w-0">
          <div class="flex items-baseline gap-2 flex-wrap mb-1">
            <span class="text-[13px] font-semibold text-default">
              Заблокирована задачей
            </span>
            <span class="text-[13px] text-default truncate">
              {{ dep.blockerTitle }}
            </span>
          </div>
          <div class="text-[11.5px] text-muted mb-2">
            добавлено {{ formatRelativeDate(dep.createdAt) }}
          </div>
          <div class="flex flex-wrap gap-1.5">
            <UButton
              size="xs"
              color="neutral"
              :loading="remove.isPending.value"
              @click="onRemoveBlocker(dep.blockerTaskId)"
            >
              Разблокировать
            </UButton>
            <NuxtLink :to="pageRoutes.task(workspaceId, boardId, dep.blockerTaskId)">
              <UButton size="xs" variant="outline" color="neutral">
                Перейти к блокеру
              </UButton>
            </NuxtLink>
          </div>
        </div>
      </div>

      <div
        v-if="task.blockedReason || isEditingReason"
        class="rounded-lg border border-red-100 dark:border-red-900/40 p-3.5 bg-red-50 dark:bg-red-950/40"
      >
        <div class="flex items-center gap-2 mb-1.5">
          <UIcon name="i-lucide-alert-triangle" class="size-3.5 text-red-500" />
          <span class="text-[12px] font-semibold uppercase tracking-[0.04em] text-red-600">
            Причина блокировки
          </span>
        </div>
        <textarea
          v-if="isEditingReason"
          v-model="blockedReasonDraft"
          rows="2"
          autofocus
          placeholder="Опиши, почему задача заблокирована"
          class="w-full bg-default border border-red-200 dark:border-red-900 rounded-md px-2.5 py-1.5 text-[13px] text-default leading-snug outline-none focus:border-red-500"
          @blur="commitEditReason"
          @keyup.esc="isEditingReason = false"
        />
        <button
          v-else
          type="button"
          class="text-[13px] text-default leading-snug whitespace-pre-wrap bg-transparent border-0 p-0 text-left w-full cursor-text"
          @click="startEditReason"
        >
          {{ task.blockedReason }}
        </button>
      </div>

      <button
        v-if="!task.blockedReason && !isEditingReason"
        type="button"
        class="inline-flex items-center gap-1.5 text-[12px] text-muted bg-transparent border-0 p-0 mt-2 cursor-pointer hover:text-accent-500 transition-colors"
        @click="startEditReason"
      >
        <UIcon name="i-lucide-plus" class="size-3" />
        Добавить причину блокировки
      </button>
    </section>

    <section>
      <div class="flex items-center gap-2 mb-2.5">
        <h4 class="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted m-0">
          Зависимости
        </h4>
        <div class="flex-1" />
        <button
          type="button"
          class="h-6 px-2 rounded-md border border-dashed border-default text-[12px] text-muted inline-flex items-center gap-1 cursor-pointer transition-colors hover:border-accent-500 hover:text-accent-500 hover:border-solid"
          @click="dependencyPickerOpen = true"
        >
          <UIcon name="i-lucide-plus" class="size-3" />
          Добавить зависимость
        </button>
      </div>

      <div v-if="blockers.length === 0 && blocks.length === 0" class="text-[13px] text-muted py-1.5">
        У задачи пока нет зависимостей.
      </div>

      <div v-else class="space-y-1.5">
        <div
          v-for="dep in blockers"
          :key="`bl-${dep.blockerTaskId}`"
          class="flex items-center gap-2.5 px-3 py-2 rounded-md border border-default bg-default hover:border-zinc-400 transition-colors"
        >
          <span class="text-[11px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded bg-accent-50 dark:bg-accent-950 text-accent-600 dark:text-accent-300 whitespace-nowrap">
            Блокируется
          </span>
          <NuxtLink
            :to="pageRoutes.task(workspaceId, boardId, dep.blockerTaskId)"
            class="flex-1 text-[13px] text-default truncate hover:text-accent-600"
          >
            {{ dep.blockerTitle }}
          </NuxtLink>
          <span
            class="text-[11px] px-1.5 py-0.5 rounded-full"
            :class="{
              'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300': statusOf(dep.blockerTaskId).tone === 'done',
              'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300': statusOf(dep.blockerTaskId).tone === 'progress',
              'bg-elevated text-muted': statusOf(dep.blockerTaskId).tone === 'default',
            }"
          >
            {{ statusOf(dep.blockerTaskId).label }}
          </span>
        </div>

        <div
          v-for="dep in blocks"
          :key="`bk-${dep.blockedTaskId}`"
          class="flex items-center gap-2.5 px-3 py-2 rounded-md border border-default bg-default hover:border-zinc-400 transition-colors"
        >
          <span class="text-[11px] font-semibold uppercase tracking-[0.04em] px-1.5 py-0.5 rounded bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300 whitespace-nowrap">
            Блокирует
          </span>
          <NuxtLink
            :to="pageRoutes.task(workspaceId, boardId, dep.blockedTaskId)"
            class="flex-1 text-[13px] text-default truncate hover:text-accent-600"
          >
            {{ dep.blockedTitle }}
          </NuxtLink>
          <span
            class="text-[11px] px-1.5 py-0.5 rounded-full"
            :class="{
              'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300': statusOf(dep.blockedTaskId).tone === 'done',
              'bg-blue-50 dark:bg-blue-950 text-blue-700 dark:text-blue-300': statusOf(dep.blockedTaskId).tone === 'progress',
              'bg-elevated text-muted': statusOf(dep.blockedTaskId).tone === 'default',
            }"
          >
            {{ statusOf(dep.blockedTaskId).label }}
          </span>
        </div>
      </div>
    </section>

    <TaskPickerModal
      v-model:open="blockerPickerOpen"
      :tasks="boardTasks"
      :columns="columns"
      :exclude-ids="excludeIds"
      title="Кто блокирует эту задачу?"
      placeholder="Найди задачу-блокера…"
      @select="onAddBlocker"
    />

    <TaskPickerModal
      v-model:open="dependencyPickerOpen"
      :tasks="boardTasks"
      :columns="columns"
      :exclude-ids="excludeIds"
      title="Добавить зависимость"
      placeholder="Найди связанную задачу…"
      @select="onAddBlocker"
    />
  </div>
</template>