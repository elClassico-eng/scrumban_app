<script setup lang="ts">
const props = defineProps<{
  workspaceName: string
  loading?: boolean
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()

const typed = ref('')
watch(open, (v) => { if (v) typed.value = '' })
const matches = computed(() => typed.value.trim() === props.workspaceName.trim())
</script>

<template>
  <UModal v-model:open="open" title="Удалить workspace" :ui="{ content: 'max-w-md' }">
    <template #body>
      <div class="space-y-4">
        <div class="flex items-start gap-2.5">
          <UIcon name="i-lucide-alert-triangle" class="size-5 text-red-500 shrink-0 mt-0.5" />
          <p class="m-0 text-[13px] text-default leading-relaxed">
            Это безвозвратно удалит workspace <b>«{{ workspaceName }}»</b> со всеми досками,
            задачами и спринтами. Действие необратимо.
          </p>
        </div>
        <UFormField :label="`Введите «${workspaceName}» для подтверждения`">
          <UInput v-model="typed" class="w-full" autofocus />
        </UFormField>
        <div class="flex justify-end gap-2 pt-2">
          <UButton type="button" variant="ghost" color="neutral" @click="open = false">
            Отмена
          </UButton>
          <UButton color="error" :disabled="!matches" :loading="loading" @click="emit('confirm')">
            Удалить навсегда
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>