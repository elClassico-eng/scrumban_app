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
  <div class="mt-5 first:mt-2">
    <div
      class="group/head flex items-center gap-2.5 h-9 px-2 sticky top-9 z-20 bg-default cursor-pointer select-none"
      @click="emit('toggle-collapse', group.key)"
    >
      <span class="text-dimmed grid place-items-center transition-transform" :class="collapsed ? '-rotate-90' : ''">
        <UIcon name="i-lucide-chevron-down" class="size-3.5" />
      </span>
      <span class="inline-flex items-center gap-[6px] h-[22px] px-2.5 rounded-md text-[11px] font-bold uppercase tracking-[0.03em] text-white" :class="group.pillClass">
        {{ group.title }}
      </span>
      <span
        class="text-[11px] font-mono tabular-nums"
        :class="over ? 'text-red-600 font-bold' : warn ? 'text-accent-600 font-semibold' : 'text-dimmed'"
      >{{ count }}{{ group.limit != null ? ` / ${group.limit}` : '' }}</span>
      <span v-if="group.limit != null" class="w-12 h-1 bg-muted rounded-full overflow-hidden">
        <span class="block h-full rounded-full" :class="over ? 'bg-red-500' : warn ? 'bg-accent-500' : 'bg-zinc-400 dark:bg-zinc-500'" :style="{ width: `${wipPct}%` }" />
      </span>
      <span class="flex-1" />
      <span v-if="spSum > 0" class="text-[10.5px] text-dimmed tabular-nums"><b class="text-muted font-semibold">{{ spSum }}</b> SP</span>
    </div>

    <template v-if="!collapsed">
      <div v-if="count === 0" class="py-3 pl-[34px] text-[12px] text-dimmed">Нет задач</div>
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
        v-if="canCreate"
        type="button"
        class="flex items-center gap-2 h-9 pl-[34px] pr-2 text-[12px] text-dimmed hover:text-accent-500 w-full text-left transition-colors"
        @click="onAdd"
      >
        <UIcon name="i-lucide-plus" class="size-3.5" />
        Добавить задачу
      </button>
    </template>
  </div>
</template>
