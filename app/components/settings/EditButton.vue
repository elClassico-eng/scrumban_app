<script setup lang="ts">
defineEmits<{ click: [] }>()
</script>

<template>
  <UButton size="sm" color="neutral" variant="soft" icon="i-hugeicons-pencil-edit-02" @click="$emit('click')">
    Изменить
  </UButton>
</template>
