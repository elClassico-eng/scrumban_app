<script setup lang="ts">
const props = defineProps<{
  workspaceName: string
  currentLabel: string | null
  suggestions: string[]
  loading?: boolean
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ submit: [label: string | null] }>()

const value = ref(props.currentLabel ?? '')
watch(open, (v) => { if (v) value.value = props.currentLabel ?? '' })

function apply() {
  emit('submit', value.value.trim() || null)
}
</script>

<template>
  <UModal v-model:open="open" :title="`Ярлык · ${workspaceName}`" :ui="{ content: 'max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <UFormField label="Ярлык" hint="Личная категория, видна только вам">
          <UInput
            v-model="value"
            class="w-full"
            :maxlength="40"
            autofocus
            placeholder="Работа, Личное, Учёба…"
          />
        </UFormField>
        <div v-if="suggestions.length" class="flex flex-wrap gap-1.5">
          <button
            v-for="s in suggestions"
            :key="s"
            type="button"
            class="text-[12px] px-2 py-0.5 rounded-full border border-default text-muted hover:border-accent-300 hover:text-accent-600 transition-colors cursor-pointer"
            @click="value = s"
          >
            {{ s }}
          </button>
        </div>
        <div class="flex items-center gap-2 pt-2">
          <UButton
            v-if="currentLabel"
            type="button"
            variant="ghost"
            color="error"
            :loading="loading"
            @click="emit('submit', null)"
          >
            Убрать
          </UButton>
          <div class="flex gap-2 ml-auto">
            <UButton type="button" variant="ghost" color="neutral" @click="open = false">
              Отмена
            </UButton>
            <UButton type="button" :loading="loading" @click="apply">
              Сохранить
            </UButton>
          </div>
        </div>
      </div>
    </template>
  </UModal>
</template>