<script setup lang="ts">
import { DateFormatter, getLocalTimeZone, parseDate } from '@internationalized/date'

const model = defineModel<string>({ default: '' })
const props = defineProps<{ placeholder?: string; size?: 'sm' | 'md' }>()

const open = ref(false)

const fmt = new DateFormatter('ru-RU', { day: 'numeric', month: 'long', year: 'numeric' })
const label = computed(() => {
  if (!model.value) return props.placeholder ?? 'Выбрать дату'
  try {
    return fmt.format(parseDate(model.value).toDate(getLocalTimeZone()))
  }
  catch {
    return model.value
  }
})

const triggerClass = computed(() =>
  props.size === 'sm' ? 'h-7 px-2 text-[12.5px]' : 'h-8 px-2.5 text-sm',
)

function onPicked(v: string) {
  model.value = v
  if (v) open.value = false
}
</script>

<template>
  <UPopover v-model:open="open">
    <button
      type="button"
      class="w-full inline-flex items-center gap-2 rounded-md border border-default bg-default text-left transition-colors hover:border-accent-300"
      :class="[triggerClass, model ? 'text-highlighted' : 'text-dimmed']"
    >
      <UIcon name="i-lucide-calendar" class="size-4 shrink-0 text-muted" />
      <span class="truncate">{{ label }}</span>
      <UIcon
        v-if="model"
        name="i-lucide-x"
        class="size-3.5 shrink-0 ml-auto text-dimmed hover:text-red-500 transition-colors"
        @click.stop="model = ''"
      />
    </button>
    <template #content>
      <CommonDateCalendar :model-value="model" class="p-2" @update:model-value="onPicked" />
    </template>
  </UPopover>
</template>
