<script setup lang="ts">
import { passwordRules } from '#shared/validation/password'

const props = defineProps<{
  password: string
}>()

const checks = computed(() =>
  passwordRules.map(rule => ({
    id: rule.id,
    label: rule.label,
    passed: rule.test(props.password),
  })),
)
</script>

<template>
  <ul class="space-y-1 text-xs">
    <li
      v-for="check in checks"
      :key="check.id"
      class="flex items-center gap-1.5 transition-colors"
      :class="check.passed ? 'text-success-600' : 'text-muted'"
    >
      <UIcon
        :name="check.passed ? 'i-lucide-check-circle-2' : 'i-lucide-circle'"
        class="size-3.5 shrink-0"
      />
      <span>{{ check.label }}</span>
    </li>
  </ul>
</template>