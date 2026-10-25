<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import { useQueryClient } from '@tanstack/vue-query'
import type { ServiceClass } from '#shared/types/domain'
import type { BoardColumn as Column } from '#shared/types/column'
import type { Task } from '#shared/types/task'
import type { MemberView } from '#shared/types/workspace'
import { apiRoutes } from '~/routing'
import { SERVICE_CLASS_INFO } from '~/utils/service-class'

type BulkResult = { taskId: string, ok: boolean, error?: string }

const props = defineProps<{
  selected: Set<string>
  tasks: Task[]
  columns: Column[]
  members: MemberView[]
  memberships: { sprintId: string, taskId: string }[]
  workspaceId: string
  boardId: string
}>()
const emit = defineEmits<{ clear: [], narrow: [ids: string[]] }>()

const qc = useQueryClient()
const toast = useToast()
const confirm = useConfirm()
const taskKey = useTaskKey(() => props.workspaceId)
const { current } = useCurrentWorkspace()
const { list: sprintsList } = useSprintsApi(toRef(props, 'workspaceId'), toRef(props, 'boardId'))

const canForce = computed(() => hasRole(current.value?.role, 'scrum_master'))
const canDelete = computed(() => hasRole(current.value?.role, 'admin'))

const ids = computed(() => [...props.selected])
const chosen = computed(() => props.tasks.filter(t => props.selected.has(t.id)))
const pending = ref(false)

async function run(action: Record<string, unknown>, done: string, opts: { keepSelection?: boolean } = {}) {
  if (pending.value) return
  pending.value = true
  try {
    const { results } = await $fetch<{ results: BulkResult[] }>(apiRoutes.tasksBulk(props.workspaceId, props.boardId), {
      method: 'POST',
      body: { taskIds: ids.value, action },
    })
    report(results, done)
    const failed = results.filter(r => !r.ok).map(r => r.taskId)
    if (failed.length) emit('narrow', failed)
    else if (!opts.keepSelection) emit('clear')
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось выполнить действие'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }
  finally {
    pending.value = false
    qc.invalidateQueries({ queryKey: ['tasks', props.workspaceId, props.boardId] })
    qc.invalidateQueries({ queryKey: ['board-sprint-memberships', props.workspaceId, props.boardId] })
    qc.invalidateQueries({ queryKey: ['task-subtasks'] })
  }
}

function report(results: BulkResult[], done: string) {
  const failed = results.filter(r => !r.ok)
  if (!failed.length) {
    toast.add({ title: done, icon: 'i-hugeicons-checkmark-circle-02' })
    return
  }
  const keyOf = (id: string) => {
    const t = props.tasks.find(x => x.id === id)
    return t ? taskKey(t) : 'задача'
  }
  const byReason = new Map<string, string[]>()
  for (const r of failed) {
    const reason = (r.error ?? 'Ошибка').split('. ')[0]!.replace(/\.$/, '')
    byReason.set(reason, [...(byReason.get(reason) ?? []), keyOf(r.taskId)])
  }
  toast.add({
    title: failed.length === results.length
      ? `Не получилось ни для одной из ${results.length}`
      : `Готово для ${results.length - failed.length} из ${results.length}, остальные остались выбранными`,
    description: [...byReason].map(([reason, keys]) => `${keys.slice(0, 4).join(', ')}${keys.length > 4 ? ` и ещё ${keys.length - 4}` : ''} – ${reason}`).join('\n'),
    color: 'warning',
    icon: 'i-hugeicons-alert-02',
    duration: 8000,
    ui: { description: 'whitespace-pre-line' },
  })
}

function freeSlots(column: Column) {
  if (column.wipLimit == null) return null
  const inColumn = props.tasks.filter(t => t.columnId === column.id).length
  return Math.max(0, column.wipLimit - inColumn)
}

async function moveTo(column: Column) {
  const moving = chosen.value.filter(t => t.columnId !== column.id)
  if (!moving.length) return
  const incoming = moving.filter(t => t.serviceClass !== 'expedite').length
  const free = freeSlots(column)
  let force = false
  if (free !== null && incoming > free && canForce.value) {
    force = await confirm({
      title: `В «${column.name}» поместится ${free} из ${incoming}`,
      description: `WIP-лимит колонки – ${column.wipLimit}. Перенести всё сверх лимита? Иначе перенесутся только задачи, которые влезают.`,
      confirmLabel: 'Перенести всё',
      cancelLabel: 'Только сколько влезет',
      confirmColor: 'warning',
    })
  }
  run(force ? { type: 'move', columnId: column.id, force: true, forceReason: 'Массовый перенос сверх WIP-лимита' } : { type: 'move', columnId: column.id }, `Перенесено в «${column.name}»`)
}

const statusItems = computed<DropdownMenuItem[][]>(() => [props.columns.map((c) => {
  const free = freeSlots(c)
  return {
    label: c.name,
    hint: free === null ? undefined : `мест: ${free}`,
    icon: c.columnRole === 'done' ? 'i-hugeicons-checkmark-circle-02' : 'i-hugeicons-square-kanban',
    onSelect: () => moveTo(c),
  }
})])

const classItems = computed<DropdownMenuItem[][]>(() => [
  (Object.keys(SERVICE_CLASS_INFO) as ServiceClass[]).map(value => ({
    label: SERVICE_CLASS_INFO[value].shortLabel,
    onSelect: () => run({ type: 'service_class', value }, `Класс: ${SERVICE_CLASS_INFO[value].shortLabel}`),
  })),
])

const assigneeItems = computed<DropdownMenuItem[][]>(() => [
  props.members.map(m => ({
    label: displayName(m),
    avatar: m.avatarUrl ? { src: m.avatarUrl } : { text: initials(m) },
    onSelect: () => run({ type: 'assignee', userId: m.userId }, `Исполнитель: ${displayName(m)}`),
  })),
  [{ label: 'Снять исполнителей', icon: 'i-hugeicons-user-remove-01', onSelect: () => run({ type: 'assignee', userId: null }, 'Исполнители сняты') }],
])

const dueOpen = ref(false)
function applyDue(v: string | null) {
  dueOpen.value = false
  run({ type: 'due', dueDate: v ? new Date(`${v}T23:59:59Z`).toISOString() : null }, v ? 'Срок обновлён' : 'Срок убран')
}

const openSprints = computed(() => (sprintsList.data.value?.sprints ?? []).filter(s => s.state !== 'closed'))
const sprintItems = computed<DropdownMenuItem[][]>(() => {
  const inSprints = new Set(props.memberships.filter(m => props.selected.has(m.taskId)).map(m => m.sprintId))
  const add = openSprints.value.map(s => ({
    label: s.name,
    hint: s.state === 'active' ? 'идёт' : undefined,
    icon: 'i-hugeicons-plus-sign',
    onSelect: () => run({ type: 'sprint_add', sprintId: s.id }, `Добавлено в «${s.name}»`),
  }))
  const remove = openSprints.value.filter(s => inSprints.has(s.id)).map(s => ({
    label: `Убрать из «${s.name}»`,
    icon: 'i-hugeicons-minus-sign',
    onSelect: () => run({ type: 'sprint_remove', sprintId: s.id }, `Убрано из «${s.name}»`),
  }))
  if (!add.length) return [[{ label: 'Нет открытых спринтов', disabled: true }]]
  return [[{ type: 'label' as const, label: 'Добавить в спринт' }, ...add], ...(remove.length ? [remove] : [])]
})

async function copyKeys() {
  await navigator.clipboard.writeText(chosen.value.map(t => `${taskKey(t)} ${t.title}`).join('\n'))
  toast.add({ title: `Скопировано: ${chosen.value.length}`, icon: 'i-hugeicons-copy-01' })
}

async function removeSelected() {
  const ok = await confirm({
    title: `Удалить задачи: ${props.selected.size}?`,
    description: 'Задачи удалятся вместе с подзадачами, комментариями и историей. Это нельзя отменить.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (ok) run({ type: 'delete' }, 'Задачи удалены')
}

const moreItems = computed<DropdownMenuItem[][]>(() => {
  const epics = props.tasks.filter(t => t.isEpic && !props.selected.has(t.id))
  return [
    [
      {
        label: 'В эпик',
        icon: 'i-hugeicons-layers-01',
        disabled: !epics.length,
        children: [
          epics.map(e => ({ label: `${taskKey(e)} ${e.title}`, onSelect: () => run({ type: 'parent', parentTaskId: e.id }, `Перенесено в эпик ${taskKey(e)}`) })),
          [{ label: 'Убрать из эпика', icon: 'i-hugeicons-minus-sign', onSelect: () => run({ type: 'parent', parentTaskId: null }, 'Убрано из эпика') }],
        ],
      },
      { label: 'Скопировать номера', icon: 'i-hugeicons-copy-01', onSelect: copyKeys },
    ],
    ...(canDelete.value ? [[{ label: 'Удалить', icon: 'i-hugeicons-delete-02', color: 'error' as const, onSelect: removeSelected }]] : []),
  ]
})

function hintOf(item: unknown) {
  return (item as { hint?: string }).hint
}

const btn = 'h-[30px] px-3 bg-white/10 hover:bg-white/20 data-[state=open]:bg-white/20 rounded-full text-[12.5px] font-medium inline-flex items-center gap-1.5 transition-colors disabled:opacity-50'
</script>

<template>
  <div class="sticky bottom-4 z-50 mx-auto flex w-max max-w-[calc(100vw-1.5rem)] items-center gap-2.5 rounded-full bg-zinc-900 py-2 pl-4 pr-2.5 text-white shadow-[0_12px_32px_-8px_rgba(0,0,0,0.45)] ring-1 ring-white/10 sm:gap-3.5 sm:pl-[18px]">
    <span class="whitespace-nowrap text-[13px] font-semibold"><b class="text-accent-500">{{ selected.size }}</b> выбрано</span>
    <div class="flex items-center gap-1 overflow-x-auto">
      <UDropdownMenu :items="statusItems" :content="{ side: 'top' }" :ui="{ content: 'w-56' }">
        <button type="button" :class="btn" :disabled="pending">
          <UIcon name="i-hugeicons-square-kanban" class="size-3.5" /> <span class="hidden sm:inline">Статус</span>
        </button>
        <template #item-trailing="{ item }">
          <span v-if="hintOf(item)" class="text-xs text-dimmed">{{ hintOf(item) }}</span>
        </template>
      </UDropdownMenu>
      <UDropdownMenu :items="classItems" :content="{ side: 'top' }" :ui="{ content: 'w-48' }">
        <button type="button" :class="btn" :disabled="pending">
          <UIcon name="i-hugeicons-flag-02" class="size-3.5" /> <span class="hidden sm:inline">Класс</span>
        </button>
      </UDropdownMenu>
      <UDropdownMenu :items="assigneeItems" :content="{ side: 'top' }" :ui="{ content: 'w-60 max-h-72' }">
        <button type="button" :class="btn" :disabled="pending">
          <UIcon name="i-hugeicons-user" class="size-3.5" /> <span class="hidden sm:inline">Исполнитель</span>
        </button>
      </UDropdownMenu>
      <UPopover v-model:open="dueOpen" :content="{ side: 'top' }">
        <button type="button" :class="btn" :disabled="pending">
          <UIcon name="i-hugeicons-calendar-03" class="size-3.5" /> <span class="hidden sm:inline">Срок</span>
        </button>
        <template #content>
          <div class="space-y-1 p-2">
            <CommonDateCalendar @update:model-value="applyDue" />
            <UButton block size="sm" variant="ghost" color="neutral" icon="i-hugeicons-calendar-remove-01" @click="applyDue(null)">
              Убрать срок
            </UButton>
          </div>
        </template>
      </UPopover>
      <UDropdownMenu :items="sprintItems" :content="{ side: 'top' }" :ui="{ content: 'w-80' }">
        <button type="button" :class="btn" :disabled="pending">
          <UIcon name="i-hugeicons-repeat" class="size-3.5" /> <span class="hidden sm:inline">Спринт</span>
        </button>
        <template #item-trailing="{ item }">
          <span v-if="hintOf(item)" class="text-xs text-dimmed">{{ hintOf(item) }}</span>
        </template>
      </UDropdownMenu>
      <UDropdownMenu :items="moreItems" :content="{ side: 'top' }" :ui="{ content: 'w-56' }">
        <button type="button" :class="btn" :disabled="pending" aria-label="Ещё действия">
          <UIcon name="i-hugeicons-more-horizontal" class="size-3.5" />
        </button>
      </UDropdownMenu>
      <span class="mx-0.5 h-5 w-px bg-white/15" />
      <button type="button" class="grid size-[30px] place-items-center rounded-full text-white/70 hover:bg-white/10" title="Снять выбор (Esc)" aria-label="Снять выбор" @click="emit('clear')">
        <UIcon name="i-hugeicons-x" class="size-4" />
      </button>
    </div>
  </div>
</template>
