<script setup lang="ts">
import { useMutation, useQueryClient } from '@tanstack/vue-query'
import { SLE_PROBABILITIES, type BoardDefaults } from '#shared/types/board-defaults'
import { apiRoutes } from '~/routing'

const DEFAULTS: Required<BoardDefaults> = { sleProbability: 0.85, replenishmentPeriodDays: 7, columnTint: false }

const { current: workspace } = useSettingsWorkspace()
const qc = useQueryClient()
const toast = useToast()

const state = reactive<Required<BoardDefaults>>({ ...DEFAULTS })
function fromWorkspace(): Required<BoardDefaults> {
  return { ...DEFAULTS, ...workspace.value?.boardDefaults }
}
function reset() {
  Object.assign(state, fromWorkspace())
}
watch(workspace, reset, { immediate: true })
const dirty = computed(() => JSON.stringify(state) !== JSON.stringify(fromWorkspace()))

const save = useMutation({
  mutationFn: () => $fetch(apiRoutes.boardDefaults(workspace.value!.id), { method: 'PUT', body: { ...state } }),
  onSuccess: async () => {
    await qc.invalidateQueries({ queryKey: ['workspaces'] })
    toast.add({ title: 'Сохранено', color: 'success', icon: 'i-hugeicons-checkmark-circle-02', duration: 1500 })
  },
  onError: err => toast.add({ title: getErrorMessage(err, 'Не удалось сохранить'), color: 'error', icon: 'i-hugeicons-alert-circle' }),
})

const probabilityItems = SLE_PROBABILITIES.map(p => ({ label: p === 0.85 ? '85% (типично)' : `${p * 100}%`, value: p }))
</script>

<template>
  <SettingsTile v-if="workspace" title="Настройки новых досок" description="Подставятся в каждую новую доску. Старые доски не трогаем">
    <div class="space-y-5">
      <div class="grid gap-4 sm:grid-cols-2">
        <UFormField label="Вероятность SLE" hint="N% задач закрываются в срок">
          <USelect v-model="state.sleProbability" :items="probabilityItems" class="w-full" />
        </UFormField>
        <UFormField label="Период планирования, дней" hint="1–60">
          <UInput v-model="state.replenishmentPeriodDays" type="number" :min="1" :max="60" class="w-full" />
        </UFormField>
      </div>
      <UFormField label="Фон колонок">
        <URadioGroup
          v-model="state.columnTint"
          orientation="horizontal"
          :items="[{ label: 'Нейтральный', value: false }, { label: 'В цвет колонки', value: true }]"
        />
      </UFormField>
      <div class="flex justify-end gap-2">
        <UButton variant="ghost" color="neutral" :disabled="!dirty" @click="reset">Отмена</UButton>
        <UButton :disabled="!dirty" :loading="save.isPending.value" @click="save.mutate()">Сохранить</UButton>
      </div>
    </div>
  </SettingsTile>
</template>
