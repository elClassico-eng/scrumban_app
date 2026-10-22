<script setup lang="ts">
defineProps<{
  workspaceName: string
  loading?: boolean
}>()
const open = defineModel<boolean>('open', { default: false })
const emit = defineEmits<{ confirm: [] }>()
</script>

<template>
  <UiTypeToConfirmModal
    v-model:open="open"
    title="Удалить workspace"
    :name="workspaceName"
    :loading="loading"
    @confirm="emit('confirm')"
  >
    Это безвозвратно удалит workspace <b>«{{ workspaceName }}»</b> со всеми досками,
    задачами и спринтами. Действие необратимо.
  </UiTypeToConfirmModal>
</template>
