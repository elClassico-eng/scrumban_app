<script setup lang="ts">
const props = defineProps<{
  description: string
}>()

const emit = defineEmits<{
  save: [value: string]
}>()

const toast = useToast()
const isEditing = ref(false)
const draft = ref(props.description)
const textareaWrapper = ref<HTMLElement | null>(null)

watch(() => props.description, (v) => {
  if (!isEditing.value) draft.value = v
})

function startEdit() {
  draft.value = props.description
  isEditing.value = true
  nextTick(() => {
    textareaWrapper.value?.querySelector('textarea')?.focus()
  })
}

function commitEdit() {
  isEditing.value = false
  const next = draft.value
  if (next !== props.description) emit('save', next)
}

function cancelEdit() {
  draft.value = props.description
  isEditing.value = false
}

function onComingSoon(feature: string) {
  toast.add({
    title: `${feature} скоро будет`,
    icon: 'i-lucide-sparkles',
    duration: 1500,
  })
}
</script>

<template>
  <section>
    <div class="flex items-center gap-2 mb-2.5">
      <h4 class="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted m-0">
        Описание
      </h4>
      <div class="flex-1" />
      <button
        type="button"
        class="h-6 px-2 rounded-md border border-dashed border-default text-[12px] text-muted inline-flex items-center gap-1 cursor-pointer transition-colors hover:border-accent-500 hover:text-accent-500 hover:border-solid"
        @click="onComingSoon('Улучшить с AI')"
      >
        <UIcon name="i-lucide-sparkles" class="size-3" />
        Улучшить с AI
      </button>
      <button
        type="button"
        class="h-6 px-2 rounded-md border border-dashed border-default text-[12px] text-muted inline-flex items-center gap-1 cursor-pointer transition-colors hover:border-accent-500 hover:text-accent-500 hover:border-solid"
        @click="onComingSoon('Вложение')"
      >
        <UIcon name="i-lucide-plus" class="size-3" />
        Вложение
      </button>
    </div>

    <div v-if="isEditing" ref="textareaWrapper" class="w-full">
      <textarea
        v-model="draft"
        rows="8"
        autofocus
        placeholder="Напиши описание задачи…"
        class="block w-full text-[14px] leading-[1.65] text-default bg-default border border-default rounded-md px-3 py-2.5 outline-none focus:border-accent-500 focus:ring-2 focus:ring-accent-50 transition-colors resize-y font-sans"
        @keydown.esc="cancelEdit"
      />
      <div class="flex items-center gap-2 mt-2">
        <UButton size="xs" @click="commitEdit">Сохранить</UButton>
        <UButton size="xs" variant="ghost" color="neutral" @click="cancelEdit">
          Отмена
        </UButton>
        <span class="text-[11px] text-muted ml-auto">Esc для отмены</span>
      </div>
    </div>

    <template v-else>
      <button
        v-if="!description"
        type="button"
        class="w-full text-left text-[14px] text-muted italic py-1 px-0 bg-transparent border-0 cursor-pointer hover:text-default transition-colors"
        @click="startEdit"
      >
        Добавьте описание
      </button>

      <div
        v-else
        class="text-[14px] text-default leading-[1.65] whitespace-pre-wrap break-words cursor-text"
        @click="startEdit"
      >
        {{ description }}
      </div>

      <button
        v-if="description"
        type="button"
        class="inline-flex items-center gap-1.5 text-[12px] text-muted bg-transparent border-0 p-0 mt-3 cursor-pointer hover:text-accent-500 transition-colors"
        @click="startEdit"
      >
        <UIcon name="i-lucide-pencil" class="size-3" />
        Редактировать описание
      </button>
    </template>
  </section>
</template>