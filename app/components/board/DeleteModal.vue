<script setup lang="ts">
const props = defineProps<{ workspaceId: string }>()

const { deleteTarget, confirmDelete, deleting } = useBoardActions(() => props.workspaceId)
const open = computed({
  get: () => deleteTarget.value !== null,
  set: (v) => { if (!v) deleteTarget.value = null },
})
</script>

<template>
  <UiTypeToConfirmModal
    v-if="deleteTarget"
    v-model:open="open"
    title="Удалить доску"
    :name="deleteTarget.name"
    :loading="deleting"
    @confirm="confirmDelete"
  >
    Это безвозвратно удалит доску <b>«{{ deleteTarget.name }}»</b> со всеми колонками, задачами,
    спринтами и историей для аналитики. Если доска просто больше не нужна, уберите её в архив.
  </UiTypeToConfirmModal>
</template>
