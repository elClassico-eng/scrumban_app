<script setup lang="ts">
import type { DropdownMenuItem } from '@nuxt/ui'
import type { AutomationRule } from '#shared/types/automation'
import { ACTION_INFO, TRIGGER_INFO } from '~/utils/automation-labels'

const props = defineProps<{
  rule: AutomationRule
  canManage: boolean
  busy?: boolean
}>()

const emit = defineEmits<{
  toggle: [enabled: boolean]
  edit: []
  remove: []
}>()

const trigger = computed(() => TRIGGER_INFO[props.rule.trigger])
const sentence = computed(() => trigger.value.sentence(props.rule.triggerParams))
const actionSentence = computed(() => ACTION_INFO[props.rule.action].sentence(props.rule.actionParams))

const menu = computed<DropdownMenuItem[]>(() => [
  { label: 'Изменить', icon: 'i-lucide-pencil', onSelect: () => emit('edit') },
  { label: 'Удалить', icon: 'i-lucide-trash-2', color: 'error', onSelect: () => emit('remove') },
])
</script>

<template>
  <div
    class="px-5 py-4 flex items-center gap-4 transition-colors hover:bg-elevated/40"
    :class="!rule.enabled ? 'opacity-60' : ''"
  >
    <span
      class="size-9 rounded-xl grid place-items-center shrink-0"
      :class="rule.enabled ? 'bg-accent-500/10 text-accent-500' : 'bg-elevated text-muted'"
    >
      <UIcon :name="trigger.icon" class="size-4" />
    </span>

    <div class="flex-1 min-w-0">
      <p class="text-[14px] text-default leading-snug">
        <span class="text-muted">Если&nbsp;</span><b class="font-semibold">{{ sentence }}</b><span class="text-muted">&nbsp;→&nbsp;</span><b class="font-semibold">{{ actionSentence }}</b>
      </p>
      <div class="flex flex-wrap items-center gap-3 mt-1 text-[12px] text-muted">
        <span
          v-if="rule.openFirings > 0"
          class="inline-flex items-center gap-1 h-5 px-1.5 rounded text-[11px] font-medium bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-300"
        >
          <span class="size-1.5 rounded-full bg-red-500" />
          горит сейчас: {{ rule.openFirings }}
        </span>
        <span v-if="rule.lastFiredAt">последнее: {{ formatRelativeDate(rule.lastFiredAt) }}</span>
        <span v-else>ещё не срабатывало</span>
      </div>
    </div>

    <template v-if="canManage">
      <USwitch
        :model-value="rule.enabled"
        :disabled="busy"
        @update:model-value="(v: boolean) => emit('toggle', v)"
      />
      <UDropdownMenu :items="menu">
        <UButton icon="i-lucide-ellipsis-vertical" color="neutral" variant="ghost" size="sm" />
      </UDropdownMenu>
    </template>
  </div>
</template>
