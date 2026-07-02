<script setup lang="ts">
import { z } from 'zod'
import { BOARD_COLOR_RE, DEFAULT_BOARD_COLOR } from '#shared/constants/board-colors'
import type { Board } from '#shared/types/board'

const props = defineProps<{
  workspaceId: string
  boardId: string
  board: Board | undefined
}>()
const open = defineModel<boolean>('open', { default: false })

const wsId = computed(() => props.workspaceId)
const { update, recomputeSLE } = useBoardsApi(wsId)
const toast = useToast()

const schema = z.object({
  color: z.string().regex(BOARD_COLOR_RE),
  sleDays: z.number().int().positive().nullable(),
  sleProbability: z.number().min(0.5).max(0.99),
  replenishmentPeriodDays: z.number().int().positive().max(60),
})
type State = z.infer<typeof schema>
const state = reactive<State>({
  color: DEFAULT_BOARD_COLOR,
  sleDays: null,
  sleProbability: 0.85,
  replenishmentPeriodDays: 7,
})

watch(
  () => props.board,
  (b) => {
    if (!b) return
    state.color = b.color
    state.sleDays = b.sleDays
    state.sleProbability = Number(b.sleProbability)
    state.replenishmentPeriodDays = b.replenishmentPeriodDays
  },
  { immediate: true },
)

async function onRecompute() {
  try {
    const res = await recomputeSLE.mutateAsync(props.boardId)
    if (res.sleDays === null) {
      toast.add({
        title: 'Недостаточно данных',
        description: `Нужно ≥5 закрытых задач за 90 дней, есть ${res.sampleCount}`,
        color: 'warning',
        icon: 'i-lucide-alert-circle',
      })
    }
    else {
      
      state.sleDays = res.sleDays
      toast.add({
        title: `SLE: ${(state.sleProbability * 100).toFixed(0)}% задач за ${res.sleDays} дней`,
        description: `Рассчитано по ${res.sampleCount} закрытым задачам`,
        color: 'success',
        icon: 'i-lucide-check-circle',
      })
    }
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось пересчитать SLE'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

async function onSave() {
  try {
    await update.mutateAsync({
      boardId: props.boardId,
      color: state.color,
      sleDays: state.sleDays,
      sleProbability: state.sleProbability,
      replenishmentPeriodDays: state.replenishmentPeriodDays,
    })
    open.value = false
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сохранить'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Настройки доски" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-5" :on-submit="onSave">
        <div>
          <p class="text-xs uppercase tracking-wide text-muted mb-2">Цвет доски</p>
          <BoardColorPicker v-model="state.color" />
        </div>

        <div class="pt-4 border-t border-default">
          <p class="text-xs uppercase tracking-wide text-muted mb-2">Service Level Expectation</p>
          <p class="text-sm text-muted mb-3">
            SLE — вероятностное обещание: «N% задач закрывается за ≤ M дней».
            Считается как перцентиль времени выполнения по закрытым задачам доски.
            Показывается плашкой «SLE» в центре управления; от этого же порога
            краснеют зависшие карточки на доске (aging).
          </p>

          <div class="grid grid-cols-2 gap-3">
            <UFormField label="Вероятность" name="sleProbability">
              <USelect
                v-model="state.sleProbability"
                :items="[
                  { label: '50%', value: 0.5 },
                  { label: '70%', value: 0.7 },
                  { label: '85% (typical)', value: 0.85 },
                  { label: '95%', value: 0.95 },
                ]"
                class="w-full"
              />
            </UFormField>
            <UFormField label="Дней (manual)" name="sleDays">
              <UInput
                :model-value="state.sleDays ?? undefined"
                type="number"
                min="1"
                class="w-full"
                placeholder="не задано"
                @update:model-value="(v: string | number) => state.sleDays = v === '' || v == null ? null : Number(v)"
              />
            </UFormField>
          </div>
          <UButton
            icon="i-lucide-refresh-cw"
            color="neutral"
            variant="soft"
            size="sm"
            class="mt-3"
            :loading="recomputeSLE.isPending.value"
            @click="onRecompute"
          >
            Пересчитать из истории
          </UButton>
        </div>

        <div class="pt-4 border-t border-default">
          <p class="text-xs uppercase tracking-wide text-muted mb-2">Replenishment cadence</p>
          <p class="text-sm text-muted mb-3">
            Период встреч планирования backlog'а. Бейдж в шапке доски подсветит когда период истёк.
          </p>
          <UFormField label="Период, дней" name="replenishmentPeriodDays">
            <UInput v-model="state.replenishmentPeriodDays" type="number" min="1" max="60" class="w-full" />
          </UFormField>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <UButton type="button" variant="ghost" color="neutral" @click="open = false">
            Отмена
          </UButton>
          <UButton type="submit" :loading="update.isPending.value">
            Сохранить
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>