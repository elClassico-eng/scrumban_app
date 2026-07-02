<script setup lang="ts">
import { z } from 'zod'

const props = defineProps<{
  workspaceId: string
  boardId: string
  columnId: string
  columnName?: string | null
  parentTaskId?: string | null
  parentTitle?: string | null
  initialDueDate?: string | null
}>()
const open = defineModel<boolean>('open', { default: false })

const schema = z.object({
  title: z.string().trim().min(1, 'Введи название').max(255),
  description: z.string().max(20_000).optional(),
  serviceClass: z.enum(['expedite', 'fixed_date', 'standard', 'intangible']),
  dueDate: z.string().optional(),
  assigneeId: z.string().nullable(),
})

type State = z.infer<typeof schema>
const state = reactive<State>({
  title: '',
  description: '',
  serviceClass: 'standard',
  dueDate: '',
  assigneeId: null,
})

const wsId = computed(() => props.workspaceId)
const bId = computed(() => props.boardId)
const { create } = useTasksApi(wsId, bId)
const { list: membersList } = useMembersApi(wsId)

const assigneeOptions = computed(() => [
  { label: 'Не назначен', value: null },
  ...(membersList.data.value?.members ?? []).map(m => ({
    label: displayName(m),
    value: m.userId,
    avatar: m.avatarUrl ? { src: m.avatarUrl, alt: displayName(m) } : { text: initials(m) },
  })),
])

const isMac = computed(() => import.meta.client && /Mac|iPhone|iPad/i.test(navigator.userAgent))
const submitHint = computed(() => (isMac.value ? '⌘ + Enter' : 'Ctrl + Enter'))
const titleCount = computed(() => state.title.length)
const canSubmit = computed(() => state.title.trim().length > 0)

function ymd(offsetDays: number): string {
  const d = new Date()
  d.setDate(d.getDate() + offsetDays)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

const dueChips = computed(() => [
  { label: 'Сегодня', value: ymd(0) },
  { label: 'Завтра', value: ymd(1) },
  { label: 'Через 3 дня', value: ymd(3) },
  { label: 'Неделя', value: ymd(7) },
])

const errorMessage = computed(() =>
  create.isError.value ? getErrorMessage(create.error.value, 'Не удалось создать задачу') : null,
)

function resetForm() {
  state.title = ''
  state.description = ''
  state.serviceClass = 'standard'
  state.dueDate = props.initialDueDate ?? ''
  state.assigneeId = null
  create.reset()
}

async function onSubmit() {
  if (!canSubmit.value) return
  try {
    await create.mutateAsync({
      columnId: props.columnId,
      title: state.title,
      description: state.description || undefined,
      serviceClass: state.serviceClass,
      dueDate: state.dueDate
        ? new Date(`${state.dueDate}T23:59:59Z`).toISOString()
        : null,
      assigneeId: state.assigneeId,
      parentTaskId: props.parentTaskId ?? null,
    })
    open.value = false
    resetForm()
  }
  catch {
    // surfaced via UAlert
  }
}

function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    onSubmit()
  }
}

watch(open, (v) => {
  if (v) state.dueDate = props.initialDueDate ?? ''
  else resetForm()
})
</script>

<template>
  <UModal
    v-model:open="open"
    :title="parentTaskId ? 'Новая подзадача' : 'Новая задача'"
    :description="parentTaskId ? undefined : (columnName ? `Задача попадёт в колонку «${columnName}»` : undefined)"
    :ui="{ content: 'max-w-lg', description: 'text-[12.5px]' }"
  >
    <template #body>
      <UForm
        :schema="schema"
        :state="state"
        class="flex flex-col gap-5"
        :on-submit="onSubmit"
        @keydown="onKeydown"
      >
        <div
          v-if="parentTaskId && parentTitle"
          class="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-elevated text-[12.5px]"
        >
          <UIcon name="i-lucide-corner-down-right" class="size-3.5 text-muted shrink-0" />
          <span class="text-muted shrink-0">Родитель:</span>
          <span class="truncate text-highlighted">{{ parentTitle }}</span>
        </div>

        <UFormField name="title" required :ui="{ error: 'mt-1' }">
          <UInput
            v-model="state.title"
            placeholder="Что нужно сделать? Напр. «Сверстать карточку задачи»"
            variant="none"
            autofocus
            class="w-full"
            :ui="{
              base: 'px-0 text-lg font-semibold text-highlighted placeholder:text-dimmed placeholder:font-normal',
            }"
          />
          <div class="h-px bg-accented" />
          <p v-if="titleCount > 200" class="mt-1 text-right text-[11px] tabular-nums text-dimmed">
            {{ titleCount }} / 255
          </p>
        </UFormField>

        <UFormField label="Описание" name="description" hint="необязательно">
          <UTextarea
            v-model="state.description"
            :rows="4"
            placeholder="Контекст, ссылки, критерии готовности…"
            class="w-full"
          />
        </UFormField>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <UFormField label="Дедлайн" name="dueDate" hint="необязательно">
            <div class="flex flex-wrap gap-1 mb-2">
              <button
                v-for="chip in dueChips"
                :key="chip.label"
                type="button"
                class="px-2 py-1 rounded-md text-[11.5px] font-medium border transition-colors cursor-pointer"
                :class="state.dueDate === chip.value
                  ? 'border-accent-500 text-accent-600 dark:text-accent-400 bg-accent-50 dark:bg-accent-950/50'
                  : 'border-default text-muted hover:border-accent-300 hover:text-accent-600'"
                @click="state.dueDate = chip.value"
              >
                {{ chip.label }}
              </button>
              <button
                v-if="state.dueDate"
                type="button"
                class="px-2 py-1 rounded-md text-[11.5px] font-medium text-muted hover:text-red-500 transition-colors cursor-pointer"
                @click="state.dueDate = ''"
              >
                Убрать
              </button>
            </div>
            <CommonDatePicker v-model="state.dueDate" placeholder="Выбрать дату" />
          </UFormField>

          <UFormField label="Исполнитель" name="assigneeId">
            <USelectMenu
              v-model="state.assigneeId"
              :items="assigneeOptions"
              value-key="value"
              :search-input="{ placeholder: 'Поиск по участникам…' }"
              placeholder="Не назначен"
              class="w-full"
            />
          </UFormField>
        </div>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          :title="errorMessage"
          icon="i-lucide-alert-circle"
        />

        <div class="flex items-center justify-between gap-2 pt-1">
          <span class="hidden sm:inline text-[11.5px] text-dimmed">
            {{ submitHint }} — создать
          </span>
          <div class="flex items-center gap-2 ml-auto">
            <UButton type="button" variant="ghost" color="neutral" @click="open = false">
              Отмена
            </UButton>
            <UButton
              type="submit"
              color="accent"
              :disabled="!canSubmit"
              :loading="create.isPending.value"
            >
              Создать
            </UButton>
          </div>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
