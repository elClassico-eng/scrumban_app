<script setup lang="ts">
export type WizardBasics = {
  name: string
  goal: string
  plannedStartAt: string
  plannedEndAt: string
  capacity: number | null
}

const basics = defineModel<WizardBasics>({ required: true })

const nameTouched = ref(false)

const nameError = computed(() =>
  nameTouched.value && basics.value.name.trim().length === 0 ? 'Название обязательно' : undefined,
)

const dateError = computed(() => {
  const { plannedStartAt, plannedEndAt } = basics.value
  if (!plannedStartAt || !plannedEndAt) return undefined
  return plannedStartAt >= plannedEndAt ? 'Окончание должно быть позже старта' : undefined
})

defineExpose({
  valid: computed(() => basics.value.name.trim().length > 0 && !dateError.value),
})
</script>

<template>
  <div class="space-y-6">
    <UFormField label="Название спринта" size="xl" required :error="nameError">
      <UInput
        v-model="basics.name"
        size="xl"
        class="w-full"
        maxlength="255"
        placeholder="Спринт 12 · Интеграции"
        autofocus
        @blur="nameTouched = true"
      />
    </UFormField>

    <UFormField
      label="Цель спринта"
      size="xl"
      hint="одна фраза: зачем этот спринт"
    >
      <UTextarea
        v-model="basics.goal"
        size="xl"
        :rows="3"
        class="w-full"
        placeholder="Довести обмен с 1С до боевого состояния"
        maxlength="10000"
      />
    </UFormField>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <UFormField label="Старт" size="xl" :error="dateError ? ' ' : undefined">
        <CommonDatePicker v-model="basics.plannedStartAt" />
      </UFormField>
      <UFormField label="Окончание" size="xl" :error="dateError">
        <CommonDatePicker v-model="basics.plannedEndAt" />
      </UFormField>
    </div>

    <UFormField
      label="Вместимость команды"
      size="xl"
      hint="story points на спринт; можно оставить пустой"
    >
      <UInput
        :model-value="basics.capacity ?? undefined"
        type="number"
        size="xl"
        min="0"
        max="10000"
        class="w-48"
        placeholder="Например, 30"
        @update:model-value="basics.capacity = $event === undefined || String($event) === '' ? null : Number($event)"
      />
    </UFormField>
  </div>
</template>
