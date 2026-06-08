<script setup lang="ts">
import { z } from 'zod'

const props = defineProps<{
  entityLabel: string
  currentName: string
  loading?: boolean
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [name: string] }>()

const schema = z.object({
  name: z.string().trim().min(1, 'Введи название').max(255),
})
type State = z.infer<typeof schema>
const state = reactive<State>({ name: props.currentName })

watch(open, (v) => {
  if (v) state.name = props.currentName
})

function onSubmit() {
  emit('submit', state.name.trim())
}
</script>

<template>
  <UModal v-model:open="open" :title="`Переименовать ${entityLabel}`" :ui="{ content: 'max-w-md' }">
    <template #body>
      <UForm :schema="schema" :state="state" class="space-y-4" @submit="onSubmit">
        <UFormField label="Название" name="name" required>
          <UInput v-model="state.name" class="w-full" autofocus />
        </UFormField>
        <div class="flex justify-end gap-2 pt-2">
          <UButton type="button" variant="ghost" color="neutral" @click="open = false">
            Отмена
          </UButton>
          <UButton type="submit" :loading="loading">
            Сохранить
          </UButton>
        </div>
      </UForm>
    </template>
  </UModal>
</template>
