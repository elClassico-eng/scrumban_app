<script setup lang="ts">
import type { Task } from '#shared/types/task'
import { pageRoutes } from '~/routing'

type Member = {
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  avatarUrl: string | null
}

const props = defineProps<{
  wsId: string
  tasks: Task[]
  boards: { id: string, name: string }[]
  members: Member[]
}>()

const MAX_ROWS = 8

const expanded = ref(false)
const items = computed(() => buildAttention(props.tasks.filter(t => !t.closedAt)))
const rows = computed(() => (expanded.value ? items.value : items.value.slice(0, MAX_ROWS)))
const hidden = computed(() => Math.max(0, items.value.length - MAX_ROWS))

const counts = computed(() => ({
  overdue: items.value.filter(i => i.kind === 'overdue').length,
  blocked: items.value.filter(i => i.kind === 'blocked').length,
  soon: items.value.filter(i => i.kind === 'due_soon').length,
}))

const boardName = computed(() => {
  const map = new Map(props.boards.map(b => [b.id, b.name]))
  return (id: string) => map.get(id) ?? ''
})

const memberById = computed(() => new Map(props.members.map(m => [m.userId, m])))

function owners(ids: string[]) {
  return ids.map(id => memberById.value.get(id)).filter((m): m is Member => !!m)
}
</script>

<template>
  <section class="surface-soft flex min-w-0 flex-col rounded-2xl p-5">
    <div class="mb-4 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
      <h2 class="font-semibold text-default">Требует внимания</h2>
      <p v-if="items.length" class="text-xs text-muted">
        <span class="text-error-600">{{ counts.overdue }}</span> просрочено ·
        <span class="text-error-600">{{ counts.blocked }}</span> в блоке ·
        <span class="text-accent-600">{{ counts.soon }}</span> скоро
      </p>
    </div>

    <ul v-if="rows.length" class="min-h-0 flex-1 divide-y divide-default overflow-y-auto pr-1">
      <li v-for="item in rows" :key="item.id">
        <NuxtLink
          :to="pageRoutes.task(wsId, item.boardId, item.id)"
          class="flex items-start gap-3 py-3 transition-colors hover:bg-elevated"
        >
          <span
            :class="[
              'mt-0.5 grid size-7 shrink-0 place-items-center rounded-lg',
              ATTENTION_TONE[item.kind].bg,
              ATTENTION_TONE[item.kind].text,
            ]"
          >
            <UIcon :name="ATTENTION_TONE[item.kind].icon" class="size-4" />
          </span>

          <span class="min-w-0 flex-1">
            <span class="block truncate text-sm text-default">{{ item.title }}</span>
            <span class="mt-0.5 block truncate text-xs text-muted">
              <span class="sm:hidden">{{ item.stateLabel }}{{ ' ' }}</span>
              <span :class="['sm:hidden', ATTENTION_TONE[item.kind].text]">{{ item.stateValue }}</span>
              <span class="sm:hidden"> · </span>
              {{ boardName(item.boardId) }}
              <template v-if="item.reason"> · {{ item.reason }}</template>
            </span>
          </span>

          <span class="flex shrink-0 items-center gap-2">
            <span v-if="owners(item.assigneeIds).length" class="flex -space-x-1.5">
              <template v-for="m in owners(item.assigneeIds).slice(0, 3)" :key="m.userId">
                <img
                  v-if="m.avatarUrl"
                  :src="m.avatarUrl"
                  :alt="displayName(m)"
                  :title="displayName(m)"
                  class="size-6 rounded-full object-cover ring-2 ring-default"
                >
                <span
                  v-else
                  :title="displayName(m)"
                  class="grid size-6 place-items-center rounded-full text-[10px] font-medium text-white ring-2 ring-default"
                  :style="{ background: avatarColor(m.userId) }"
                >
                  {{ initials(m) }}
                </span>
              </template>
            </span>
            <span v-else class="hidden text-xs text-muted sm:inline">без исполнителя</span>
            <span class="hidden whitespace-nowrap text-right text-xs tabular-nums sm:inline">
              <span v-if="item.stateLabel" class="text-muted">{{ item.stateLabel }}{{ ' ' }}</span>
              <span :class="ATTENTION_TONE[item.kind].text">{{ item.stateValue }}</span>
            </span>
          </span>
        </NuxtLink>
      </li>
    </ul>

    <p v-else class="text-sm text-muted">Ничего не требует внимания.</p>

    <button
      v-if="hidden"
      type="button"
      class="mt-3 inline-flex items-center gap-1 text-xs font-medium text-muted transition-colors hover:text-accent-600"
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
