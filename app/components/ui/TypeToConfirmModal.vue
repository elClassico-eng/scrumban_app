<script setup lang="ts">
const props = withDefaults(defineProps<{
  title: string
  name: string
  confirmLabel?: string
  loading?: boolean
}>(), { confirmLabel: 'Удалить навсегда', loading: false })
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()

const typed = ref('')
watch(open, (v) => { if (v) typed.value = '' })
const matches = computed(() => typed.value.trim() === props.name.trim())
</script>

<template>
  <UModal v-model:open="open" :title="title" :ui="{ content: 'max-w-md' }">
    <template #body>
      <form class="space-y-4" @submit.prevent="matches && emit('confirm')">
        <div class="flex items-start gap-2.5">
          <UIcon name="i-hugeicons-triangle-alert" class="mt-0.5 size-5 shrink-0 text-red-500" />
          <p class="m-0 text-[13px] leading-relaxed text-default">
            <slot />
          </p>
        </div>
        <UFormField :label="`Введите «${name}» для подтверждения`">
          <UInput v-model="typed" class="w-full" autofocus />
        </UFormField>
        <div class="flex justify-end gap-2 pt-2">
          <UButton type="button" variant="ghost" color="neutral" @click="open = false">
            Отмена
          </UButton>
          <UButton type="submit" color="error" :disabled="!matches" :loading="loading">
            {{ confirmLabel }}
          </UButton>
        </div>
      </form>
    </template>
  </UModal>
</template>
