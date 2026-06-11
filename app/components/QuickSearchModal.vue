<script setup lang="ts">
import { pageRoutes } from '~/routing'

const route = useRoute()
const router = useRouter()
const { searchTick } = useControlCenterActions()

const open = ref(false)
const query = ref('')

const wsId = computed(() => (route.params.id as string) ?? '')
const bId = computed(() => (route.params.boardId as string) ?? '')
const onBoard = computed(() => !!wsId.value && !!bId.value)

const { list } = useTasksApi(wsId, bId)
const tasks = computed(() => list.data.value?.tasks ?? [])

const results = computed(() => {
  const q = query.value.trim().toLowerCase()
  const all = tasks.value
  if (!q) return all.slice(0, 25)
  return all
    .filter(t => t.title.toLowerCase().includes(q) || t.id.slice(0, 8).toLowerCase().includes(q))
    .slice(0, 25)
})

function openSearch() {
  query.value = ''
  open.value = true
}

function selectTask(taskId: string) {
  open.value = false
  router.push(pageRoutes.task(wsId.value, bId.value, taskId))
}

watch(searchTick, openSearch)

useEventListener(window, 'keydown', (e: KeyboardEvent) => {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    openSearch()
  }
})
</script>

<template>
  <UModal v-model:open="open" title="Поиск задач" :ui="{ content: 'max-w-lg' }">
    <template #body>
      <div class="space-y-3">
        <UInput
          v-model="query"
          autofocus
          placeholder="Название или ID задачи…"
          icon="i-lucide-search"
          class="w-full"
        />
        <div v-if="!onBoard" class="py-8 text-center text-sm text-muted">
          Открой доску, чтобы искать задачи
        </div>
        <div v-else-if="results.length === 0" class="py-8 text-center text-sm text-muted">
          Ничего не найдено
        </div>
        <ul v-else class="max-h-80 overflow-auto">
          <li v-for="t in results" :key="t.id">
            <button
              type="button"
              class="w-full text-left px-3 py-2 rounded-lg hover:bg-elevated flex items-center gap-2.5"
              @click="selectTask(t.id)"
            >
              <span class="font-mono text-[11px] text-muted shrink-0">{{ t.id.slice(0, 6).toUpperCase() }}</span>
              <span class="truncate text-sm text-default">{{ t.title }}</span>
            </button>
          </li>
        </ul>
      </div>
    </template>
  </UModal>
</template>
