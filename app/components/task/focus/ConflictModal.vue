<script setup lang="ts">
const props = defineProps<{
  field: 'title' | 'description'
  theirs: string
  mine: string
}>()
const emit = defineEmits<{ keepMine: [], takeTheirs: [] }>()

const toast = useToast()
const label = computed(() => (props.field === 'title' ? 'Название' : 'Описание'))

async function copyMine() {
  await navigator.clipboard.writeText(props.mine)
  toast.add({ title: 'Ваш текст скопирован', icon: 'i-hugeicons-copy-01' })
}
</script>

<template>
  <UModal
    :open="true"
    :title="`${label} изменили, пока вы редактировали`"
    description="Выберите, какую версию оставить. Ничего не сохранится, пока вы не решите."
    :dismissible="false"
    :close="false"
    :ui="{ content: 'max-w-2xl' }"
  >
    <template #body>
      <div class="grid gap-3 sm:grid-cols-2">
        <section class="space-y-1.5">
          <p class="text-[11px] font-semibold uppercase tracking-wider text-dimmed">Сейчас в задаче</p>
          <p class="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl bg-elevated p-3 text-sm text-default">{{ theirs || 'Пусто' }}</p>
        </section>
        <section class="space-y-1.5">
          <div class="flex items-center justify-between">
            <p class="text-[11px] font-semibold uppercase tracking-wider text-accent-600 dark:text-accent-400">Ваша версия</p>
            <UButton size="xs" color="neutral" variant="ghost" icon="i-hugeicons-copy-01" @click="copyMine">
              Скопировать
            </UButton>
          </div>
          <p class="max-h-72 overflow-y-auto whitespace-pre-wrap rounded-xl border border-accent-300 p-3 text-sm text-default dark:border-accent-700">{{ mine || 'Пусто' }}</p>
        </section>
      </div>
      <div class="mt-5 flex flex-wrap justify-end gap-2">
        <UButton color="neutral" variant="outline" @click="emit('takeTheirs')">
          Оставить как в задаче
        </UButton>
        <UButton @click="emit('keepMine')">
          Сохранить мою версию
        </UButton>
      </div>
    </template>
  </UModal>
</template>
