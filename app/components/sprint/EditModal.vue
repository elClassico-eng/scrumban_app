<script setup lang="ts">
import type { Sprint } from '#shared/types/sprint'

const props = defineProps<{
  workspaceId: string
  boardId: string
  sprint: Sprint | null
}>()

const open = defineModel<boolean>('open', { default: false })

const { update } = useSprintsApi(
  computed(() => props.workspaceId),
  computed(() => props.boardId),
)

const toast = useToast()

const state = reactive({
  name: '',
  goal: '',
  plannedStartAt: '',
  plannedEndAt: '',
  capacity: null as number | null,
  datesChangeReason: '',
})

const isActive = computed(() => props.sprint?.state === 'active')

function toDateInput(iso: string | null): string {
  return iso ? iso.slice(0, 10) : ''
}

watch(
  () => [open.value, props.sprint?.id],
  () => {
    if (!open.value || !props.sprint) return
    state.name = props.sprint.name
    state.goal = props.sprint.goal
    state.plannedStartAt = toDateInput(props.sprint.plannedStartAt)
    state.plannedEndAt = toDateInput(props.sprint.plannedEndAt)
    state.capacity = props.sprint.capacity
    state.datesChangeReason = ''
    update.reset()
  },
)

const datesChanged = computed(() => {
  if (!props.sprint) return false
  return (
    state.plannedStartAt !== toDateInput(props.sprint.plannedStartAt) ||
    state.plannedEndAt !== toDateInput(props.sprint.plannedEndAt)
  )
})

const needsReason = computed(() => isActive.value && datesChanged.value)
const canSubmit = computed(() =>
  state.name.trim().length > 0 && (!needsReason.value || state.datesChangeReason.trim().length > 0),
)

function toIsoOrNull(value: string): string | null {
  if (!value) return null
  return new Date(value + 'T00:00:00Z').toISOString()
}

async function submit() {
  if (!props.sprint || !canSubmit.value) return
  try {
    await update.mutateAsync({
      sprintId: props.sprint.id,
      name: state.name.trim(),
      ...(isActive.value ? {} : { goal: state.goal }),
      plannedStartAt: toIsoOrNull(state.plannedStartAt),
      plannedEndAt: toIsoOrNull(state.plannedEndAt),
      capacity: state.capacity,
      ...(needsReason.value ? { datesChangeReason: state.datesChangeReason.trim() } : {}),
    })
    toast.add({ title: 'Спринт обновлён', icon: 'i-lucide-check', duration: 1500 })
    open.value = false
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось обновить спринт'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}
</script>

<template>
  <UModal v-model:open="open" :title="`Редактировать «${sprint?.name ?? ''}»`">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Название" required>
          <UInput v-model="state.name" class="w-full" maxlength="255" />
        </UFormField>

        <UFormField label="Цель спринта">
          <template v-if="isActive" #hint>
            <UTooltip text="По Scrum цель спринта фиксируется на весь спринт. Изменить её можно только у запланированного.">
              <span class="inline-flex items-center gap-1 text-[11px] text-muted cursor-help">
                <UIcon name="i-lucide-lock" class="size-3" />
                зафиксирована
              </span>
            </UTooltip>
          </template>
          <UTextarea v-model="state.goal" :disabled="isActive" :rows="2" class="w-full" />
        </UFormField>

        <div class="grid grid-cols-2 gap-3">
          <UFormField label="Старт">
            <CommonDatePicker v-model="state.plannedStartAt" />
          </UFormField>
          <UFormField label="Окончание">
            <CommonDatePicker v-model="state.plannedEndAt" />
          </UFormField>
        </div>

        <UFormField v-if="needsReason" label="Причина переноса дат" required>
          <UInput
            v-model="state.datesChangeReason"
            class="w-full"
            maxlength="500"
            placeholder="Например: смежники задержали интеграцию"
          />
          <template #help>
            <span class="text-[11px] text-muted">
              Спринт активен — сдвиг дат попадёт в отчёт с этой причиной.
            </span>
          </template>
        </UFormField>

        <UFormField label="Вместимость (SP)">
          <UInput
            :model-value="state.capacity ?? undefined"
            type="number"
            min="0"
            max="10000"
            class="w-40"
            placeholder="Не задана"
            @update:model-value="state.capacity = $event === undefined || String($event) === '' ? null : Number($event)"
          />
        </UFormField>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <UButton variant="ghost" color="neutral" @click="open = false">Отмена</UButton>
        <UButton :disabled="!canSubmit" :loading="update.isPending.value" @click="submit">
          Сохранить
        </UButton>
      </div>
    </template>
  </UModal>
</template>
