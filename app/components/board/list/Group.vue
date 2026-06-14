<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { MemberView } from '#shared/types/workspace'
import type { BoardColumn as Column } from '#shared/types/column'
import type { ListGroup } from '~/utils/list-groups'

const props = defineProps<{
  group: ListGroup
  childrenByParent: Map<string, Task[]>
  members: MemberView[]
  columns: Column[]
  depCounts: Map<string, { blockerCount: number, blockedCount: number }>
  collapsed: boolean
  selected: Set<string>
  expanded: Set<string>
  canCreate: boolean
  workspaceId: string
  boardId: string
}>()

const emit = defineEmits<{
  'toggle-collapse': [key: string]
  'toggle-select': [id: string]
  'toggle-expand': [id: string]
  'add-subtask': [id: string]
  'move-to-column': [taskId: string, columnId: string]
  'create-in-column': [columnId: string]
}>()

const count = computed(() => props.group.tasks.length)
const spSum = computed(() => props.group.tasks.reduce((a, t) => a + (t.storyPoints ?? 0), 0))
const over = computed(() => props.group.limit != null && count.value > props.group.limit)
const warn = computed(() => props.group.limit != null && count.value === props.group.limit)
const wipPct = computed(() => props.group.limit != null && props.group.limit > 0 ? Math.min(100, count.value / props.group.limit * 100) : 0)

function blockerCount(id: string) {
  return props.depCounts.get(id)?.blockerCount ?? 0
}
function onAdd() {
  if (props.group.columnId) emit('create-in-column', props.group.columnId)
}
</script>

<template>
  <div>
    <div
      class="group/head flex items-center gap-2 sm:gap-[11px] px-4 sm:px-[18px] py-2.5 sm:py-[11px] cursor-pointer select-none hover:bg-muted/40 dark:hover:bg-muted/20 transition-colors sticky top-0 sm:top-[42px] bg-default z-20"
      @click="emit('toggle-collapse', group.key)"
    >
      <span
        class="text-dimmed grid place-items-center transition-transform shrink-0"
        :class="collapsed ? '-rotate-90' : ''"
      >
        <UIcon name="i-lucide-chevron-down" class="size-[15px]" />
      </span>

      <span
        class="inline-flex items-center gap-[7px] h-[24px] sm:h-[26px] px-2.5 sm:px-3 rounded-full text-[10.5px] sm:text-[11.5px] font-bold uppercase tracking-[0.04em] text-white min-w-0 shrink sm:shrink-0"
        :class="group.pillClass"
      >
        <span class="w-1.5 h-1.5 rounded-full bg-white/90 shrink-0" />
        <span class="truncate">{{ group.title }}</span>
      </span>

      <span
        class="font-mono text-[12px] tabular-nums shrink-0"
        :class="over ? 'text-red-600 dark:text-red-400' : warn ? 'text-accent-600 dark:text-accent-400' : 'text-muted'"
      >
        <b :class="over ? 'text-red-600 dark:text-red-400 font-bold' : warn ? 'text-accent-600 dark:text-accent-400 font-bold' : 'text-default font-semibold'">{{ count }}</b>
        <template v-if="group.limit != null"> / {{ group.limit }}</template>
      </span>

      <span v-if="group.limit != null" class="hidden sm:inline-block w-[72px] h-[5px] bg-elevated dark:bg-accented rounded-full overflow-hidden shrink-0">
        <span
          class="block h-full rounded-full transition-[width] duration-300"
          :class="over ? 'bg-red-500' : warn ? 'bg-accent-500' : 'bg-zinc-400 dark:bg-zinc-500'"
          :style="{ width: `${wipPct}%` }"
        />
      </span>

      <span class="flex-1" />

      <span v-if="spSum > 0" class="hidden sm:inline-block text-[11.5px] text-dimmed tabular-nums shrink-0">
        <b class="text-toned font-semibold">{{ spSum }}</b> SP
      </span>

      <button
        v-if="canCreate"
        type="button"
        class="size-[26px] rounded-[7px] border border-default bg-default text-muted grid place-items-center shrink-0 hover:border-accent-400 hover:text-accent-500 transition-colors"
        @click.stop="onAdd"
      >
        <UIcon name="i-lucide-plus" class="size-3.5" />
      </button>
    </div>

    <template v-if="!collapsed">
      <div
        v-if="count === 0"
        class="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-2.5 mx-4 sm:mx-[18px] mb-2 ml-4 sm:ml-10 px-[14px] py-[10px] border border-dashed border-default rounded-[10px] text-dimmed text-[12.5px] bg-muted/30 dark:bg-muted/10"
      >
        <span>Нет задач — перетащите сюда или</span>
        <button
          v-if="canCreate"
          type="button"
          class="sm:ml-auto inline-flex items-center gap-[5px] text-muted font-medium hover:text-accent-500 transition-colors"
          @click="onAdd"
        >
          <UIcon name="i-lucide-plus" class="size-3" />
          добавить
        </button>
      </div>

      <template v-for="t in group.tasks" :key="t.id">
        <BoardListRow
          :task="t" :is-done="group.doneGroup || t.closedAt != null" :members="members" :columns="columns"
          :blocker-count="blockerCount(t.id)" :child-count="(childrenByParent.get(t.id)?.length ?? 0)"
          :expanded="expanded.has(t.id)" :selected="selected.has(t.id)" :depth="0"
          :can-create="canCreate" :workspace-id="workspaceId" :board-id="boardId"
          @toggle-select="emit('toggle-select', $event)"
          @toggle-expand="emit('toggle-expand', $event)"
          @add-subtask="emit('add-subtask', $event)"
          @move-to-column="(id, col) => emit('move-to-column', id, col)"
        />
        <template v-if="expanded.has(t.id)">
          <BoardListRow
            v-for="child in (childrenByParent.get(t.id) ?? [])" :key="child.id"
            :task="child" :is-done="child.closedAt != null" :members="members" :columns="columns"
            :blocker-count="blockerCount(child.id)" :child-count="0"
            :expanded="false" :selected="selected.has(child.id)" :depth="1"
            :can-create="canCreate" :workspace-id="workspaceId" :board-id="boardId"
            @toggle-select="emit('toggle-select', $event)"
            @move-to-column="(id, col) => emit('move-to-column', id, col)"
          />
        </template>
      </template>

      <button
        v-if="canCreate && count > 0"
        type="button"
        class="flex items-center gap-2 min-h-[42px] pl-4 sm:pl-[40px] pr-4 sm:pr-[18px] text-[12.5px] text-dimmed hover:text-accent-600 dark:hover:text-accent-400 w-full text-left transition-colors border-t border-[var(--ui-border-muted)]"
        @click="onAdd"
      >
        <UIcon name="i-lucide-plus" class="size-3.5" />
        Добавить задачу
      </button>
    </template>
  </div>
</template>
