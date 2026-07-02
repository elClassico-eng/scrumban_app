<script setup lang="ts">
import type { TimeEntryView } from '#shared/types/time-entry'
import type { MemberView } from '#shared/types/workspace'

const props = defineProps<{
  workspaceId: string
  boardId: string
  taskId: string
  canEdit: boolean
}>()

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const tId = computed(() => props.taskId)

const { list, start, stop, create, update, remove } = useTaskTimeApi(wsId, bId, tId)
const { list: activeList } = useActiveTimerApi(wsId)
const { list: membersList } = useMembersApi(wsId)
const { list: workspacesList } = useWorkspacesApi()
const auth = useAuthStore()
const confirm = useConfirm()
const toast = useToast()

const entries = computed(() => list.data.value?.entries ?? [])
const totalSeconds = computed(() => list.data.value?.totalSeconds ?? 0)
const active = computed(() => activeList.data.value?.active ?? null)
const members = computed(() => membersList.data.value?.members ?? [])

const currentUserId = computed(() => auth.user?.id ?? null)
const myRole = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value)?.role,
)
const canManageOthers = computed(() => hasRole(myRole.value, 'scrum_master'))

const isRunningHere = computed(
  () => active.value !== null && active.value.entry.taskId === tId.value,
)

const clockSeconds = ref(0)
let clockInterval: ReturnType<typeof setInterval> | null = null

function startClock(seed: number) {
  clockSeconds.value = seed
  clockInterval = setInterval(() => { clockSeconds.value++ }, 1000)
}

function stopClock() {
  if (clockInterval !== null) {
    clearInterval(clockInterval)
    clockInterval = null
  }
}

watch(
  () => ({ running: isRunningHere.value, elapsed: active.value?.entry.elapsedSeconds ?? 0 }),
  ({ running, elapsed }) => {
    stopClock()
    if (running) startClock(elapsed)
  },
  { immediate: true },
)

onUnmounted(stopClock)

function memberFor(entry: TimeEntryView): MemberView | undefined {
  return members.value.find(m => m.userId === entry.userId)
}

function entryDate(entry: TimeEntryView): string {
  return new Date(entry.startedAt).toLocaleDateString('ru', { day: '2-digit', month: 'short' })
}

function canAct(entry: TimeEntryView): boolean {
  if (entry.running) return false
  return entry.userId === currentUserId.value || canManageOthers.value
}

async function onDelete(entry: TimeEntryView) {
  const ok = await confirm({
    title: 'Удалить запись?',
    description: 'Это действие необратимо.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  try {
    await remove.mutateAsync(entry.id)
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось удалить'), color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

const editingId = ref<string | null>(null)
const editHours = ref(0)
const editMinutes = ref(0)
const editDate = ref('')
const editDesc = ref('')

function startEdit(entry: TimeEntryView) {
  editingId.value = entry.id
  const total = entry.durationSeconds ?? 0
  editHours.value = Math.floor(total / 3600)
  editMinutes.value = Math.floor((total % 3600) / 60)
  editDate.value = entry.startedAt.slice(0, 10)
  editDesc.value = entry.description ?? ''
}

function cancelEdit() {
  editingId.value = null
}

async function commitEdit() {
  const id = editingId.value
  if (!id) return
  const secs = editHours.value * 3600 + editMinutes.value * 60
  if (secs <= 0) {
    toast.add({ title: 'Укажи длительность > 0', color: 'error', icon: 'i-lucide-alert-circle' })
    return
  }
  try {
    await update.mutateAsync({
      entryId: id,
      durationSeconds: secs,
      startedAt: new Date(editDate.value).toISOString(),
      description: editDesc.value.trim() || null,
    })
    editingId.value = null
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось обновить'), color: 'error', icon: 'i-lucide-alert-circle' })
  }
}

const today = new Date().toISOString().slice(0, 10)
const addHours = ref(0)
const addMinutes = ref(0)
const addDate = ref(today)
const addDesc = ref('')
const addOpen = ref(false)

function openAdd() {
  addHours.value = 0
  addMinutes.value = 0
  addDate.value = today
  addDesc.value = ''
  addOpen.value = true
}

function cancelAdd() {
  addOpen.value = false
}

async function commitAdd() {
  const secs = addHours.value * 3600 + addMinutes.value * 60
  if (secs <= 0) {
    toast.add({ title: 'Укажи длительность > 0', color: 'error', icon: 'i-lucide-alert-circle' })
    return
  }
  try {
    await create.mutateAsync({
      startedAt: new Date(addDate.value).toISOString(),
      durationSeconds: secs,
      description: addDesc.value.trim() || null,
    })
    addOpen.value = false
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось добавить запись'), color: 'error', icon: 'i-lucide-alert-circle' })
  }
}
</script>

<template>
  <section class="px-[18px] py-4 border-b border-default">
    <div class="flex items-center gap-2 mb-2.5">
      <h5 class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted m-0">
        Время
      </h5>
      <div class="flex-1" />
      <span class="text-[12px] tabular-nums text-default font-medium">
        {{ formatDuration(totalSeconds) }}
      </span>
    </div>

    <div class="flex items-center gap-2 mb-3">
      <template v-if="isRunningHere">
        <span class="text-[13px] tabular-nums font-semibold text-accent-500">
          {{ formatClock(clockSeconds) }}
        </span>
        <button
          type="button"
          class="h-6 px-2 rounded-md text-[12px] bg-accent-500 text-white inline-flex items-center gap-1 cursor-pointer transition-opacity hover:opacity-80"
          :disabled="stop.isPending.value"
          @click="stop.mutate()"
        >
          <UIcon name="i-lucide-square" class="size-3" />
          Стоп
        </button>
      </template>
      <template v-else-if="canEdit">
        <button
          type="button"
          class="h-6 px-2 rounded-md text-[12px] border border-default text-muted inline-flex items-center gap-1 cursor-pointer transition-colors hover:border-accent-500 hover:text-accent-500"
          :disabled="start.isPending.value"
          @click="start.mutate()"
        >
          <UIcon name="i-lucide-play" class="size-3" />
          Старт
        </button>
      </template>
    </div>

    <div v-if="entries.length === 0" class="text-[12.5px] text-muted py-1">
      Время ещё не трекалось.
    </div>

    <div v-else class="flex flex-col gap-1 mb-3">
      <template v-for="entry in entries" :key="entry.id">
        <div v-if="editingId === entry.id" class="border border-default rounded-lg p-2.5 bg-default space-y-2">
          <div class="flex items-center gap-2">
            <label class="text-[11px] text-muted w-[56px] shrink-0">Часы</label>
            <input
              v-model.number="editHours"
              type="number"
              min="0"
              class="w-16 bg-elevated border border-default rounded-md px-2 py-0.5 text-[12.5px] text-default text-right focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-50"
            >
            <label class="text-[11px] text-muted">мин</label>
            <input
              v-model.number="editMinutes"
              type="number"
              min="0"
              max="59"
              class="w-16 bg-elevated border border-default rounded-md px-2 py-0.5 text-[12.5px] text-default text-right focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-50"
            >
          </div>
          <div class="flex items-center gap-2">
            <label class="text-[11px] text-muted w-[56px] shrink-0">Дата</label>
            <CommonDatePicker v-model="editDate" size="sm" class="flex-1" />
          </div>
          <div class="flex items-center gap-2">
            <label class="text-[11px] text-muted w-[56px] shrink-0">Описание</label>
            <input
              v-model="editDesc"
              type="text"
              placeholder="Необязательно"
              class="flex-1 bg-elevated border border-default rounded-md px-2 py-0.5 text-[12.5px] text-default placeholder:text-dimmed focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-50"
            >
          </div>
          <div class="flex gap-2 pt-1">
            <button
              type="button"
              class="h-6 px-2.5 rounded-md text-[12px] bg-accent-500 text-white inline-flex items-center cursor-pointer hover:opacity-80 transition-opacity"
              :disabled="update.isPending.value"
              @click="commitEdit"
            >
              Сохранить
            </button>
            <button
              type="button"
              class="h-6 px-2.5 rounded-md text-[12px] border border-default text-muted inline-flex items-center cursor-pointer hover:border-default hover:text-default transition-colors"
              @click="cancelEdit"
            >
              Отмена
            </button>
          </div>
        </div>

        <div
          v-else
          class="group flex items-center gap-2 px-1.5 py-1.5 rounded-md hover:bg-default transition-colors"
        >
          <UserAvatar :user="memberFor(entry)" size="sm" />
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <span class="text-[12px] text-default truncate">
                {{ displayName(memberFor(entry)) }}
              </span>
              <span
                v-if="entry.running"
                class="text-[11px] text-accent-500 font-medium shrink-0"
              >
                идёт
              </span>
              <span v-else class="text-[12px] tabular-nums text-muted shrink-0 font-medium">
                {{ formatDuration(entry.durationSeconds ?? 0) }}
              </span>
            </div>
            <div class="flex items-center gap-1.5">
              <span class="text-[11px] text-dimmed">{{ entryDate(entry) }}</span>
              <span v-if="entry.description" class="text-[11px] text-muted truncate">
                · {{ entry.description }}
              </span>
            </div>
          </div>
          <div
            v-if="canAct(entry)"
            class="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-all"
          >
            <button
              type="button"
              class="size-5 rounded grid place-items-center text-dimmed hover:bg-elevated hover:text-default transition-colors cursor-pointer"
              title="Изменить"
              @click="startEdit(entry)"
            >
              <UIcon name="i-lucide-pencil" class="size-3" />
            </button>
            <button
              type="button"
              class="size-5 rounded grid place-items-center text-dimmed hover:bg-elevated hover:text-red-500 transition-colors cursor-pointer"
              title="Удалить"
              @click="onDelete(entry)"
            >
              <UIcon name="i-lucide-trash-2" class="size-3" />
            </button>
          </div>
        </div>
      </template>
    </div>

    <template v-if="canEdit">
      <div v-if="addOpen" class="border border-default rounded-lg p-2.5 bg-default space-y-2">
        <div class="flex items-center gap-2">
          <label class="text-[11px] text-muted w-[56px] shrink-0">Часы</label>
          <input
            v-model.number="addHours"
            type="number"
            min="0"
            class="w-16 bg-elevated border border-default rounded-md px-2 py-0.5 text-[12.5px] text-default text-right focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-50"
          >
          <label class="text-[11px] text-muted">мин</label>
          <input
            v-model.number="addMinutes"
            type="number"
            min="0"
            max="59"
            class="w-16 bg-elevated border border-default rounded-md px-2 py-0.5 text-[12.5px] text-default text-right focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-50"
          >
        </div>
        <div class="flex items-center gap-2">
          <label class="text-[11px] text-muted w-[56px] shrink-0">Дата</label>
          <CommonDatePicker v-model="addDate" size="sm" class="flex-1" />
        </div>
        <div class="flex items-center gap-2">
          <label class="text-[11px] text-muted w-[56px] shrink-0">Описание</label>
          <input
            v-model="addDesc"
            type="text"
            placeholder="Необязательно"
            class="flex-1 bg-elevated border border-default rounded-md px-2 py-0.5 text-[12.5px] text-default placeholder:text-dimmed focus:outline-none focus:border-accent-500 focus:ring-1 focus:ring-accent-50"
          >
        </div>
        <div class="flex gap-2 pt-1">
          <button
            type="button"
            class="h-6 px-2.5 rounded-md text-[12px] bg-accent-500 text-white inline-flex items-center cursor-pointer hover:opacity-80 transition-opacity"
            :disabled="create.isPending.value"
            @click="commitAdd"
          >
            Добавить
          </button>
          <button
            type="button"
            class="h-6 px-2.5 rounded-md text-[12px] border border-default text-muted inline-flex items-center cursor-pointer hover:border-default hover:text-default transition-colors"
            @click="cancelAdd"
          >
            Отмена
          </button>
        </div>
      </div>
      <button
        v-else
        type="button"
        class="inline-flex items-center gap-1.5 h-[26px] px-2.5 rounded-md text-[12px] text-muted bg-transparent border border-dashed border-default cursor-pointer transition-colors hover:border-accent-500 hover:text-accent-500 hover:border-solid"
        @click="openAdd"
      >
        <UIcon name="i-lucide-plus" class="size-3" />
        Добавить вручную
      </button>
    </template>
  </section>
</template>
