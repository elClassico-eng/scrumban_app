<script setup lang="ts">
import { z } from 'zod'
import type { Board } from '#shared/types/board'

const props = defineProps<{
  workspaceId: string
  boardId: string
  board: Board | undefined
}>()
const open = defineModel<boolean>('open', { default: false })
const tab = defineModel<string>('tab', { default: 'look' })

const wsId = computed(() => props.workspaceId)
const { update, recomputeSLE } = useBoardsApi(wsId)
const { state: pachca } = usePachcaApi(wsId)
const toast = useToast()

const pachcaReady = computed(() => !!pachca.data.value?.canManage && pachca.data.value?.integration?.status === 'active')
const tabs = computed(() => [
  { value: 'look', label: 'Вид', icon: 'i-hugeicons-paint-board' },
  { value: 'flow', label: 'Поток', icon: 'i-hugeicons-chart-line-data-01' },
  ...(pachcaReady.value ? [{ value: 'feed', label: 'Пачка', icon: 'i-hugeicons-notification-02' }] : []),
])

watch([tab, () => pachca.isSuccess.value, pachcaReady], ([current, loaded, ready]) => {
  if (current === 'feed' && loaded && !ready) tab.value = 'look'
}, { immediate: true })

const schema = z.object({
  sleDays: z.number().int().positive().nullable(),
  sleProbability: z.number().min(0.5).max(0.99),
  replenishmentPeriodDays: z.number().int().positive().max(60),
  columnTint: z.boolean(),
})
type State = z.infer<typeof schema>
const state = reactive<State>({
  sleDays: null,
  sleProbability: 0.85,
  replenishmentPeriodDays: 7,
  columnTint: false,
})

watch(
  () => props.board,
  (b) => {
    if (!b) return
    state.sleDays = b.sleDays
    state.sleProbability = Number(b.sleProbability)
    state.replenishmentPeriodDays = b.replenishmentPeriodDays
    state.columnTint = b.columnTint
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
        icon: 'i-hugeicons-alert-circle',
      })
    }
    else {
      state.sleDays = res.sleDays
      toast.add({
        title: `SLE: ${(state.sleProbability * 100).toFixed(0)}% задач за ${res.sleDays} дней`,
        description: `Рассчитано по ${res.sampleCount} закрытым задачам`,
        color: 'success',
        icon: 'i-hugeicons-circle-check-big',
      })
    }
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось пересчитать SLE'),
      color: 'error',
      icon: 'i-hugeicons-alert-circle',
    })
  }
}

async function onSave() {
  try {
    await update.mutateAsync({
      boardId: props.boardId,
      sleDays: state.sleDays,
      sleProbability: state.sleProbability,
      replenishmentPeriodDays: state.replenishmentPeriodDays,
      columnTint: state.columnTint,
    })
    open.value = false
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сохранить'),
      color: 'error',
      icon: 'i-hugeicons-alert-circle',
    })
  }
}
</script>

<template>
  <UModal v-model:open="open" title="Настройки доски" :ui="{ content: 'max-w-2xl', body: 'pt-2 sm:pt-3' }">
    <template #body>
      <UTabs v-model="tab" :items="tabs" color="neutral" variant="link" :content="false" class="mb-5" />

      <UForm v-show="tab !== 'feed'" :schema="schema" :state="state" class="min-h-56" :on-submit="onSave">
        <div v-show="tab === 'look'" class="space-y-5">
          <UFormField label="Фон колонок" name="columnTint" description="Нейтральный фон спокойнее, цветной помогает различать стадии на больших досках">
            <URadioGroup
              v-model="state.columnTint"
              orientation="horizontal"
              :items="[{ label: 'Нейтральный', value: false }, { label: 'В цвет колонки', value: true }]"
            />
          </UFormField>
          <p class="text-sm text-muted">
            Название, ключ задач, цвет и картинка доски меняются в «Изменить доску».
          </p>
        </div>

        <div v-show="tab === 'flow'" class="space-y-6">
          <div>
            <div class="mb-3 flex items-baseline justify-between gap-3">
              <p class="text-sm font-medium text-default">SLE: сколько ждать закрытия задачи</p>
              <NuxtLink to="/docs/math/sle" external target="_blank" class="shrink-0 text-xs text-muted hover:text-default">Подробнее ↗</NuxtLink>
            </div>
            <p class="mb-3 text-sm text-muted">
              «N% задач закрывается за ≤ M дней». От этого порога краснеют зависшие карточки.
            </p>
            <div class="grid grid-cols-2 items-end gap-3 sm:grid-cols-[1fr_1fr_auto]">
              <UFormField label="Вероятность" name="sleProbability">
                <USelect
                  v-model="state.sleProbability"
                  :items="[
                    { label: '50%', value: 0.5 },
                    { label: '70%', value: 0.7 },
                    { label: '85% (типично)', value: 0.85 },
                    { label: '95%', value: 0.95 },
                  ]"
                  class="w-full"
                />
              </UFormField>
              <UFormField label="Дней" name="sleDays">
                <UInput
                  :model-value="state.sleDays ?? undefined"
                  type="number"
                  min="1"
                  class="w-full"
                  placeholder="не задано"
                  @update:model-value="(v: string | number) => state.sleDays = v === '' || v == null ? null : Number(v)"
                />
              </UFormField>
              <UButton
                icon="i-hugeicons-refresh-cw"
                color="neutral"
                variant="soft"
                class="col-span-2 justify-center sm:col-span-1"
                :loading="recomputeSLE.isPending.value"
                @click="onRecompute"
              >
                Из истории
              </UButton>
            </div>
          </div>

          <UFormField
            label="Период планирования, дней"
            name="replenishmentPeriodDays"
            description="Как часто команда пополняет backlog. Бейдж в шапке доски подсветит, когда период истёк"
          >
            <UInput v-model="state.replenishmentPeriodDays" type="number" min="1" max="60" class="w-40" />
          </UFormField>
        </div>
      </UForm>

      <BoardPachcaFeedSection v-if="tab === 'feed'" class="min-h-56" :workspace-id="workspaceId" :board-id="boardId" />
    </template>

    <template #footer>
      <div class="flex w-full items-center justify-end gap-2">
        <template v-if="tab === 'feed'">
          <span class="text-xs text-muted">Изменения сохраняются сразу</span>
          <UButton variant="ghost" color="neutral" @click="open = false">Закрыть</UButton>
        </template>
        <template v-else>
          <UButton variant="ghost" color="neutral" @click="open = false">Отмена</UButton>
          <UButton :loading="update.isPending.value" @click="onSave">Сохранить</UButton>
        </template>
      </div>
    </template>
  </UModal>
</template>
