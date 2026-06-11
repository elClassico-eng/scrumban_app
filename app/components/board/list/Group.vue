<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { MemberView } from '#shared/types/workspace'
import type { ListGroup } from '~/utils/list-groups'

const props = defineProps<{
  group: ListGroup
  childrenByParent: Map<string, Task[]>
  members: MemberView[]
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
  'quick-add': [group: ListGroup, title: string]
}>()

const count = computed(() => props.group.tasks.length)
const spSum = computed(() => props.group.tasks.reduce((a, t) => a + (t.storyPoints ?? 0), 0))
const over = computed(() => props.group.limit != null && count.value > props.group.limit)
const warn = computed(() => props.group.limit != null && count.value === props.group.limit)
const wipPct = computed(() => props.group.limit ? Math.min(100, count.value / props.group.limit * 100) : 0)

function blockerCount(id: string) {
  return props.depCounts.get(id)?.blockerCount ?? 0
}

const adding = ref(false)
const draft = ref('')
function commitAdd() {
  const v = draft.value.trim()
  if (!v) return
  emit('quick-add', props.group, v)
  draft.value = ''
  adding.value = false
}
</script>

<template>
  <div class="bg-default border border-default rounded-xl overflow-hidden">
    <div
      class="group/head flex items-center gap-2.5 px-3.5 py-2.5 cursor-pointer select-none border-b border-default"
      :class="collapsed ? 'border-b-transparent' : ''"
      @click="emit('toggle-collapse', group.key)"
    >
      <span class="text-muted grid place-items-center transition-transform" :class="collapsed ? '-rotate-90' : ''">
        <UIcon name="i-lucide-chevron-down" class="size-4" />
      </span>
      <span class="inline-flex items-center gap-[7px] h-6 px-2.5 rounded-full text-[11.5px] font-bold uppercase tracking-[0.04em] text-white" :class="group.pillClass">
        <span class="size-[7px] rounded-full bg-white/90" />
        {{ group.title }}
      </span>
      <span
        class="text-xs font-mono tabular-nums"
        :class="over ? 'text-red-600 font-bold' : warn ? 'text-accent-600 font-semibold' : 'text-muted'"
      >{{ count }}{{ group.limit != null ? ` / ${group.limit}` : '' }}</span>
      <span v-if="group.limit != null" class="w-[60px] h-1 bg-muted rounded-full overflow-hidden">
        <span class="block h-full rounded-full" :class="over ? 'bg-red-500' : warn ? 'bg-accent-500' : 'bg-inverted'" :style="{ width: `${wipPct}%` }" />
      </span>
      <span class="flex-1" />
      <span class="text-[11px] text-muted"><b class="text-toned font-semibold">{{ spSum }}</b> SP</span>
    </div>

    <template v-if="!collapsed">
      <div class="grid grid-cols-[var(--kl-cols)] items-center py-[7px] pr-3.5 border-b border-default bg-default sticky top-0 z-[2]">
        <span class="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted px-2.5">Задача</span>
        <span class="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted px-2.5">Исполнитель</span>
        <span class="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted px-2.5">Срок</span>
        <span class="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted px-2.5 col-class">Класс</span>
        <span class="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted px-2.5 text-center col-sp">SP</span>
        <span class="text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted px-2.5 col-clist">Чек-лист</span>
      </div>

      <div class="flex flex-col">
        <div v-if="count === 0" class="py-[18px] pl-10 pr-3.5 text-[12.5px] text-muted">Нет задач в этой группе</div>
        <template v-for="t in group.tasks" :key="t.id">
          <BoardListRow
            :task="t" :is-done="group.doneGroup || t.closedAt != null" :members="members"
            :blocker-count="blockerCount(t.id)" :child-count="(childrenByParent.get(t.id)?.length ?? 0)"
            :expanded="expanded.has(t.id)" :selected="selected.has(t.id)" :depth="0"
            :can-create="canCreate" :workspace-id="workspaceId" :board-id="boardId"
            @toggle-select="emit('toggle-select', $event)"
            @toggle-expand="emit('toggle-expand', $event)"
            @add-subtask="emit('add-subtask', $event)"
          />
          <template v-if="expanded.has(t.id)">
            <BoardListRow
              v-for="child in (childrenByParent.get(t.id) ?? [])" :key="child.id"
              :task="child" :is-done="child.closedAt != null" :members="members"
              :blocker-count="blockerCount(child.id)" :child-count="0"
              :expanded="false" :selected="selected.has(child.id)" :depth="1"
              :can-create="canCreate" :workspace-id="workspaceId" :board-id="boardId"
              @toggle-select="emit('toggle-select', $event)"
              @add-subtask="emit('add-subtask', $event)"
            />
          </template>
        </template>
      </div>

      <div v-if="canCreate && adding" class="flex items-center gap-2 py-1.5 pl-[38px] pr-3.5 border-t border-[var(--ui-border-muted)]">
        <input
          v-model="draft" autofocus placeholder="Название задачи…"
          class="flex-1 h-[30px] border border-accent-500 ring-[3px] ring-accent-50 dark:ring-accent-950 rounded-md px-2.5 text-[13px] bg-default text-default outline-none"
          @keydown.enter="commitAdd"
          @keydown.esc="adding = false; draft = ''"
        >
        <button class="h-[30px] px-3 rounded-md bg-inverted text-inverted text-xs font-medium disabled:opacity-50" :disabled="!draft.trim()" @click="commitAdd">Добавить</button>
      </div>
      <button
        v-else-if="canCreate"
        type="button"
        class="flex items-center gap-2 py-2.5 pl-10 pr-3.5 text-[12.5px] text-muted hover:text-accent-500 w-full text-left transition-colors"
        @click="adding = true"
      >
        <UIcon name="i-lucide-plus" class="size-3.5" />
        Добавить задачу
      </button>
    </template>
  </div>
</template>
