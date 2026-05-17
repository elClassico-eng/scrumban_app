<script setup lang="ts">
import type { Role } from '#shared/types/domain'

defineProps<{
  role: Role
  editable?: boolean
}>()
</script>

<template>
  <span
    class="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium"
    :class="ROLE_CHIP_CLASS[role]"
  >
    <span class="size-1.5 rounded-full" :class="ROLE_DOT_CLASS[role]" />
    {{ ROLE_LABEL[role] }}
    <UIcon v-if="editable" name="i-lucide-chevron-down" class="size-3 opacity-60" />
  </span>
</template>
