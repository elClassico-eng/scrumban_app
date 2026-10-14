<script setup lang="ts">
import type { Task } from '#shared/types/task'
import type { AttentionKind } from '~/utils/task-attention'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  wsId: string
  userId: string | null
  tasks: Task[]
  boards: { id: string, name: string }[]
}>()

const { open, attention } = useMyTasks(() => props.tasks, () => props.userId)

const GROUPS: { kind: AttentionKind; title: string }[] = [
  { kind: 'overdue', title: 'Просрочено' },
  { kind: 'blocked', title: 'В блоке' },
  { kind: 'due_soon', title: 'Ближайшие сроки' },
]
const groups = computed(() =>
  GROUPS.map(g => ({ ...g, items: attention.value.filter(i => i.kind === g.kind) })).filter(g => g.items.length > 0),
)

const boardName = computed(() => {
  const map = new Map(props.boards.map(b => [b.id, b.name]))
  return (id: string) => map.get(id) ?? ''
})
</script>

<template>
  <UiPanel title="Ваши задачи" :caption="open.length ? `${open.length} ${plural(open.length, ['открыта', 'открыто', 'открыто'])}` : undefined">
    <div v-if="groups.length" class="grid grid-cols-1 gap-x-6 gap-y-4 lg:grid-cols-3">
      <div v-for="g in groups" :key="g.kind" class="min-w-0">
        <h3 class="m-0 mb-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
          <UIcon :name="ATTENTION_TONE[g.kind].icon" :class="['size-3.5', ATTENTION_TONE[g.kind].text]" />
          {{ g.title }} · {{ g.items.length }}
        </h3>
        <ul class="m-0 list-none p-0 divide-y divide-default">
          <li v-for="item in g.items" :key="item.id">
            <NuxtLink
              :to="pageRoutes.task(wsId, item.boardId, item.id)"
              class="flex items-center gap-3 py-2 transition-colors hover:text-accent-600"
            >
              <span class="min-w-0 flex-1 truncate text-sm text-default">{{ item.title }}</span>
              <span class="hidden shrink-0 text-xs text-muted xl:inline">{{ boardName(item.boardId) }}</span>
              <span class="shrink-0 whitespace-nowrap text-xs tabular-nums">
                <span v-if="item.stateLabel" class="text-muted">{{ item.stateLabel }}{{ ' ' }}</span>
                <span :class="ATTENTION_TONE[item.kind].text">{{ item.stateValue }}</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </div>
    </div>

    <UiEmptyState v-else-if="!userId" compact icon="i-lucide-user" title="Войдите, чтобы увидеть свои задачи" />
    <UiEmptyState v-else-if="!open.length" compact icon="i-lucide-check-circle-2" title="Открытых задач на вас нет" />
    <UiEmptyState v-else compact icon="i-lucide-coffee" title="Ничего не горит" text="Ни просрочек, ни блокировок, ни близких сроков." />
  </UiPanel>
</template>
