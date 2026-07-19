<script setup lang="ts">
import type { CarryOverDecision, CloseSprintInput, Sprint } from '#shared/types/sprint'
import type { Task } from '#shared/types/task'

const props = defineProps<{
  sprint: Sprint | null
  openTasks: Task[]
  hasNextPlanned: boolean
  closing: boolean
}>()

const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [payload: CloseSprintInput] }>()

const goalAchieved = ref<boolean>(false)
const goalComment = ref('')
const decisions = ref<Record<string, CarryOverDecision>>({})

watch(
  () => [open.value, props.sprint?.id],
  () => {
    if (!open.value) return
    goalAchieved.value = false
    goalComment.value = ''
    decisions.value = Object.fromEntries(
      props.openTasks.map(t => [t.id, props.hasNextPlanned ? 'next_sprint' : 'keep'] as const),
    )
  },
)

const decisionItems = computed(() => [
  {
    label: 'В следующий спринт',
    value: 'next_sprint',
    disabled: !props.hasNextPlanned,
  },
  { label: 'В бэклог', value: 'backlog' },
  { label: 'Оставить как перенос', value: 'keep' },
])

function confirm() {
  emit('confirm', {
    goalAchieved: goalAchieved.value,
    goalComment: goalComment.value.trim() || undefined,
    carryOver: props.openTasks.map(t => ({
      taskId: t.id,
      decision: decisions.value[t.id] ?? 'keep',
    })),
  })
}
</script>

<template>
  <UModal v-model:open="open" :title="`Закрыть спринт «${sprint?.name ?? ''}»`">
    <template #body>
      <div class="space-y-5">
        <div class="space-y-2">
          <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            Цель спринта
          </div>
          <p v-if="sprint?.goal" class="text-[12.5px] text-muted m-0 leading-relaxed">
            {{ sprint.goal }}
          </p>
          <div class="flex items-center gap-2.5">
            <USwitch v-model="goalAchieved" />
            <span class="text-[13px]" :class="goalAchieved ? 'text-default font-medium' : 'text-muted'">
              {{ goalAchieved ? 'Цель достигнута' : 'Цель не достигнута' }}
            </span>
          </div>
          <UTextarea
            v-model="goalComment"
            :rows="2"
            class="w-full"
            placeholder="Комментарий к итогу (попадёт в отчёт спринта)"
            maxlength="2000"
          />
        </div>

        <div v-if="openTasks.length > 0" class="space-y-2">
          <div class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted">
            Незакрытые задачи — решение по каждой
          </div>
          <p v-if="!hasNextPlanned" class="text-[11.5px] text-dimmed m-0">
            На доске нет запланированного спринта, поэтому вариант «в следующий спринт» недоступен.
          </p>
          <div class="border border-default rounded-lg overflow-hidden divide-y divide-default">
            <div
              v-for="t in openTasks"
              :key="t.id"
              class="flex items-center gap-2.5 px-3 py-2"
            >
              <span class="truncate text-[12.5px] text-default flex-1">{{ t.title }}</span>
              <USelect
                v-model="decisions[t.id]"
                :items="decisionItems"
                value-key="value"
                size="xs"
                class="w-52 shrink-0"
              />
            </div>
          </div>
        </div>

        <p v-else class="text-[12.5px] text-muted m-0">
          Все задачи спринта закрыты — отличная работа.
        </p>

        <p class="text-[11.5px] text-dimmed m-0 leading-relaxed">
          Закрытый спринт нельзя запустить снова: состав и метрики замораживаются для аналитики,
          решения по переносам попадут в отчёт.
        </p>
      </div>
    </template>
    <template #footer>
      <div class="flex items-center justify-end gap-2 w-full">
        <UButton variant="ghost" color="neutral" @click="open = false">Отмена</UButton>
        <UButton :loading="closing" icon="i-lucide-check-square" @click="confirm">
          Закрыть спринт
        </UButton>
      </div>
    </template>
  </UModal>
</template>
