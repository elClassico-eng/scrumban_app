<script setup lang="ts">
const store = useConfirmStore()
</script>

<template>
  <UModal v-model:open="store.isOpen" :title="store.opts?.title ?? ''" :ui="{ content: 'max-w-md' }">
    <template #body>
      <p v-if="store.opts?.description" class="text-sm text-muted">
        {{ store.opts.description }}
      </p>
      <div class="flex justify-end gap-2 pt-4">
        <UButton variant="ghost" color="neutral" @click="store.resolve(false)">
          {{ store.opts?.cancelLabel ?? 'Отмена' }}
        </UButton>
        <UButton :color="store.opts?.confirmColor ?? 'primary'" @click="store.resolve(true)">
          {{ store.opts?.confirmLabel ?? 'Подтвердить' }}
        </UButton>
      </div>
    </template>
  </UModal>
</template>