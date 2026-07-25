<script setup lang="ts">
import type { Task } from '#shared/types/task'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  wsId: string
  userId: string | null
  tasks: Task[]
  boards: { id: string, name: string }[]
}>()

const MAX_ROWS = 5

const expanded = ref(false)
const { open, attention, overdue } = useMyTasks(() => props.tasks, () => props.userId)
const rows = computed(() => (expanded.value ? attention.value : attention.value.slice(0, MAX_ROWS)))
const hidden = computed(() => Math.max(0, attention.value.length - MAX_ROWS))

const boardName = computed(() => {
  const map = new Map(props.boards.map(b => [b.id, b.name]))
  return (id: string) => map.get(id) ?? ''
})
</script>

<template>
  <section class="surface-soft flex min-w-0 flex-col rounded-2xl p-5">
    <div class="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 class="font-semibold text-default">Ваши задачи</h2>
      <p v-if="open.length" class="text-xs text-muted">
        <span class="font-medium text-default">{{ open.length }}</span>
        {{ plural(open.length, ['открыта', 'открыто', 'открыто']) }}<template v-if="overdue">,
          <span class="font-medium text-error-600">{{ overdue }}</span> просрочено</template>
      </p>
    </div>

    <ul v-if="rows.length" class="mt-2 min-h-0 flex-1 divide-y divide-default overflow-y-auto pr-1">
      <li v-for="item in rows" :key="item.id">
        <NuxtLink
          :to="pageRoutes.task(wsId, item.boardId, item.id)"
          class="flex items-center gap-3 py-2.5 transition-colors hover:bg-elevated"
        >
          <UIcon
            :name="ATTENTION_TONE[item.kind].icon"
            :class="['size-4 shrink-0', ATTENTION_TONE[item.kind].text]"
          />
          <span class="min-w-0 flex-1 truncate text-sm text-default">{{ item.title }}</span>
          <span class="hidden shrink-0 text-xs text-muted sm:inline">{{ boardName(item.boardId) }}</span>
          <span class="shrink-0 whitespace-nowrap text-xs tabular-nums">
            <span v-if="item.stateLabel" class="text-muted">{{ item.stateLabel }}{{ ' ' }}</span>
            <span :class="ATTENTION_TONE[item.kind].text">{{ item.stateValue }}</span>
          </span>
        </NuxtLink>
      </li>
    </ul>

    <p v-else-if="!userId" class="mt-2 text-sm text-muted">Войдите, чтобы увидеть свои задачи.</p>
    <p v-else-if="!open.length" class="mt-2 text-sm text-muted">Открытых задач на вас нет.</p>
    <p v-else class="mt-2 text-sm text-muted">
      Ничего не горит: ни просрочек, ни блокировок, ни близких сроков.
    </p>

    <button
      v-if="hidden"
      type="button"
      class="mt-3 inline-flex items-center gap-1 self-start text-xs font-medium text-muted transition-colors hover:text-accent-600"
      @click="expanded = !expanded"
    >
      <template v-if="expanded">Свернуть</template>
      <template v-else>Показать ещё {{ hidden }}</template>
      <UIcon
        name="i-lucide-chevron-down"
        class="size-3.5 transition-transform"
        :class="expanded ? 'rotate-180' : ''"
      />
    </button>
  </section>
</template>
