<script setup lang="ts">
import type { SprintReportPayload } from '#shared/types/sprint-report'
import type { RetroCategory, RetroNote } from '~/composables/api/useSprintRetroApi'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  wsId: string
  boardId: string
  sprintId: string
  payload: SprintReportPayload | null
  prevSprintId: string | null
}>()

const { notes, create, update, remove, convert } = useSprintRetroApi(
  computed(() => props.wsId),
  computed(() => props.boardId),
  computed(() => props.sprintId),
)

const prevRetro = useSprintRetroApi(
  computed(() => props.wsId),
  computed(() => props.boardId),
  computed(() => props.prevSprintId ?? ''),
)

const { list: membersList } = useMembersApi(computed(() => props.wsId))
const { list: workspacesList } = useWorkspacesApi()
const authStore = useAuthStore()

const members = computed(() => membersList.data.value?.members ?? [])
const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === props.wsId),
)
const isAdmin = computed(() => hasRole(workspace.value?.role, 'admin'))
const canWrite = computed(() => hasRole(workspace.value?.role, 'member'))
const myId = computed(() => authStore.user?.id ?? null)

const toast = useToast()
const confirm = useConfirm()

const COLUMNS: { category: RetroCategory; title: string; icon: string; hint: string }[] = [
  { category: 'went_well', title: 'Что было хорошо', icon: 'i-lucide-thumbs-up', hint: 'Практики, которые стоит сохранить' },
  { category: 'to_improve', title: 'Что улучшить', icon: 'i-lucide-wrench', hint: 'Что мешало и тормозило' },
  { category: 'action_item', title: 'Действия', icon: 'i-lucide-list-checks', hint: 'Конкретные решения с исполнением' },
]

const drafts = reactive<Record<RetroCategory, string>>({
  went_well: '',
  to_improve: '',
  action_item: '',
})

function notesFor(category: RetroCategory): RetroNote[] {
  return (notes.data.value ?? []).filter(n => n.category === category)
}

function authorOf(note: RetroNote) {
  return members.value.find(m => m.userId === note.authorId) ?? null
}

function canManageNote(note: RetroNote): boolean {
  return isAdmin.value || (note.authorId !== null && note.authorId === myId.value)
}

async function addNote(category: RetroCategory) {
  const body = drafts[category].trim()
  if (!body) return
  try {
    await create.mutateAsync({ category, body })
    drafts[category] = ''
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось добавить заметку'), color: 'error' })
  }
}

async function deleteNote(note: RetroNote) {
  const ok = await confirm({
    title: 'Удалить заметку?',
    description: note.body.slice(0, 120),
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  try {
    await remove.mutateAsync(note.id)
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось удалить'), color: 'error' })
  }
}

async function toggleResolved(note: RetroNote, value: boolean) {
  try {
    await update.mutateAsync({ noteId: note.id, isResolved: value })
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось обновить'), color: 'error' })
  }
}

async function convertNote(note: RetroNote) {
  try {
    const res = await convert.mutateAsync(note.id)
    toast.add({
      title: res.addedToSprintId
        ? 'Задача создана и добавлена в следующий спринт'
        : 'Задача создана в бэклоге',
      icon: 'i-lucide-check',
      duration: 2500,
    })
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось создать задачу'), color: 'error' })
  }
}

const editingId = ref<string | null>(null)
const editingBody = ref('')

function startEdit(note: RetroNote) {
  editingId.value = note.id
  editingBody.value = note.body
}

async function saveEdit(note: RetroNote) {
  const body = editingBody.value.trim()
  if (!body) return
  try {
    await update.mutateAsync({ noteId: note.id, body })
    editingId.value = null
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось сохранить'), color: 'error' })
  }
}

const facts = computed(() => {
  const p = props.payload
  if (!p) return []
  const out: { icon: string; text: string; severity: 'warn' | 'info' }[] = []
  if (p.goal.achieved === false) {
    out.push({ icon: 'i-lucide-x-circle', text: 'Цель спринта не достигнута', severity: 'warn' })
  }
  if (p.totals.startCount > 0) {
    const share = Math.round((p.totals.addedAfterStartCount / p.totals.startCount) * 100)
    if (share >= 20) {
      out.push({
        icon: 'i-lucide-triangle-alert',
        text: `${share}% состава добавлено после старта — scope change выше здоровой нормы`,
        severity: 'warn',
      })
    }
  }
  for (const c of p.carryOver.filter(x => x.streak >= 2)) {
    out.push({
      icon: 'i-lucide-repeat',
      text: `«${c.title}» переносится ${c.streak}-й спринт подряд`,
      severity: 'warn',
    })
  }
  if (p.flow.cycleP85 !== null) {
    out.push({
      icon: 'i-lucide-timer',
      text: `Cycle time P85 за спринт: ${p.flow.cycleP85} дн (P50: ${p.flow.cycleP50 ?? '—'} дн)`,
      severity: 'info',
    })
  }
  if (p.totals.carryOverCount > 0) {
    out.push({
      icon: 'i-lucide-corner-down-right',
      text: `Перенесено ${p.totals.carryOverCount} задач (${p.totals.carryOverSp} SP)`,
      severity: 'info',
    })
  }
  return out
})

const prevActionItems = computed(() =>
  (prevRetro.notes.data.value ?? []).filter(n => n.category === 'action_item'),
)
const prevResolvedCount = computed(() => prevActionItems.value.filter(n => n.isResolved).length)
</script>

<template>
  <div class="space-y-4">
    <div v-if="facts.length > 0" class="bg-default border border-default rounded-2xl px-5 py-4 space-y-2.5">
      <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
        Факты спринта — темы для обсуждения
      </div>
      <div class="space-y-1.5">
        <div
          v-for="(f, i) in facts"
          :key="i"
          class="flex items-start gap-2.5 text-[13px]"
        >
          <UIcon
            :name="f.icon"
            class="size-4 shrink-0 mt-0.5"
            :class="f.severity === 'warn' ? 'text-accent-600' : 'text-muted'"
          />
          <span :class="f.severity === 'warn' ? 'text-default' : 'text-muted'">{{ f.text }}</span>
        </div>
      </div>
    </div>

    <div
      v-if="prevSprintId && prevActionItems.length > 0"
      class="bg-default border border-default rounded-2xl px-5 py-4 space-y-2.5"
    >
      <div class="flex items-center gap-2">
        <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
          Action items прошлой ретро
        </div>
        <span
          class="text-[11px] font-semibold px-1.5 py-0.5 rounded"
          :class="prevResolvedCount === prevActionItems.length
            ? 'bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300'
            : 'bg-accent-50 dark:bg-accent-950 text-accent-700 dark:text-accent-300'"
        >
          выполнено {{ prevResolvedCount }} из {{ prevActionItems.length }}
        </span>
      </div>
      <div class="space-y-1.5">
        <div
          v-for="n in prevActionItems"
          :key="n.id"
          class="flex items-center gap-2.5 text-[13px]"
        >
          <UCheckbox
            :model-value="n.isResolved"
            :disabled="!canWrite"
            @update:model-value="prevRetro.update.mutate({ noteId: n.id, isResolved: Boolean($event) })"
          />
          <span :class="n.isResolved ? 'text-muted line-through' : 'text-default'">{{ n.body }}</span>
        </div>
      </div>
    </div>

    <div class="grid grid-cols-1 lg:grid-cols-3 gap-4 items-start">
      <div
        v-for="col in COLUMNS"
        :key="col.category"
        class="bg-default border border-default rounded-2xl px-4 py-4 space-y-3"
      >
        <div>
          <div class="text-[13px] font-semibold inline-flex items-center gap-1.5">
            <UIcon :name="col.icon" class="size-4 text-accent-600" />
            {{ col.title }}
            <span class="text-[11px] text-muted font-normal">{{ notesFor(col.category).length }}</span>
          </div>
          <div class="text-[11px] text-dimmed mt-0.5">{{ col.hint }}</div>
        </div>

        <div v-if="canWrite" class="flex items-start gap-2">
          <UTextarea
            v-model="drafts[col.category]"
            :rows="2"
            autoresize
            class="flex-1"
            :placeholder="col.category === 'action_item' ? 'Что сделаем по-другому…' : 'Заметка…'"
            @keydown.meta.enter="addNote(col.category)"
          />
          <UButton
            size="sm"
            icon="i-lucide-plus"
            :disabled="!drafts[col.category].trim()"
            :loading="create.isPending.value"
            @click="addNote(col.category)"
          />
        </div>

        <div class="space-y-2">
          <div
            v-for="n in notesFor(col.category)"
            :key="n.id"
            class="border border-default rounded-xl px-3 py-2.5 space-y-2"
          >
            <div v-if="editingId === n.id" class="space-y-2">
              <UTextarea v-model="editingBody" :rows="2" autoresize class="w-full" />
              <div class="flex items-center gap-1.5 justify-end">
                <UButton size="xs" variant="ghost" color="neutral" @click="editingId = null">Отмена</UButton>
                <UButton size="xs" :loading="update.isPending.value" @click="saveEdit(n)">Сохранить</UButton>
              </div>
            </div>
            <template v-else>
              <div class="flex items-start gap-2">
                <UCheckbox
                  v-if="n.category === 'action_item'"
                  :model-value="n.isResolved"
                  :disabled="!canWrite"
                  class="mt-0.5"
                  @update:model-value="toggleResolved(n, Boolean($event))"
                />
                <p
                  class="flex-1 text-[13px] leading-relaxed m-0"
                  :class="n.isResolved && n.category === 'action_item' ? 'text-muted line-through' : 'text-default'"
                >
                  {{ n.body }}
                </p>
                <UDropdownMenu
                  v-if="canManageNote(n)"
                  :items="[
                    { label: 'Редактировать', icon: 'i-lucide-pencil', onSelect: () => startEdit(n) },
                    { label: 'Удалить', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => deleteNote(n) },
                  ]"
                >
                  <button type="button" class="size-6 rounded grid place-items-center text-dimmed hover:text-default hover:bg-elevated transition-colors cursor-pointer shrink-0">
                    <UIcon name="i-lucide-ellipsis-vertical" class="size-3.5" />
                  </button>
                </UDropdownMenu>
              </div>

              <div class="flex items-center gap-2 flex-wrap">
                <UserAvatar
                  v-if="authorOf(n)"
                  :user="authorOf(n)!"
                  size="xs"
                  tooltip
                />
                <NuxtLink
                  v-if="n.taskId"
                  :to="pageRoutes.task(wsId, boardId, n.taskId)"
                  class="text-[11px] px-1.5 py-0.5 rounded bg-elevated text-muted hover:text-default transition-colors inline-flex items-center gap-1"
                >
                  <UIcon name="i-lucide-link" class="size-3" />
                  из задачи
                </NuxtLink>
                <template v-if="n.category === 'action_item'">
                  <NuxtLink
                    v-if="n.convertedTaskId"
                    :to="pageRoutes.task(wsId, boardId, n.convertedTaskId)"
                    class="text-[11px] px-1.5 py-0.5 rounded bg-emerald-50 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 inline-flex items-center gap-1"
                  >
                    <UIcon name="i-lucide-check" class="size-3" />
                    задача создана
                  </NuxtLink>
                  <UButton
                    v-else-if="canWrite"
                    size="xs"
                    variant="outline"
                    color="neutral"
                    icon="i-lucide-arrow-right-circle"
                    :loading="convert.isPending.value"
                    @click="convertNote(n)"
                  >
                    В задачу
                  </UButton>
                </template>
              </div>
            </template>
          </div>

          <div
            v-if="notesFor(col.category).length === 0"
            class="text-[12px] text-dimmed text-center py-4"
          >
            Пока пусто
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
