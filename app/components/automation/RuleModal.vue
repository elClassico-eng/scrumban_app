<script setup lang="ts">
import type { AutomationAction, AutomationRule, AutomationTrigger, NotifyRecipients, RuleInput } from '#shared/types/automation'
import { ACTION_ALLOWED_FOR, AUTOMATION_ACTIONS, AUTOMATION_TRIGGERS, RuleInputSchema, TRIGGER_SUBJECT } from '#shared/validation/automation'
import { ACTION_INFO, RECIPIENT_LABEL, TRIGGER_INFO, TRIGGER_PARAM_FIELDS } from '~/utils/automation-labels'

const props = defineProps<{
  rule?: AutomationRule | null
  pending: boolean
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  submit: [input: RuleInput]
}>()

const trigger = ref<AutomationTrigger>('task_aging')
const action = ref<AutomationAction>('notify')
const params = ref<Record<string, number>>({})
const recipients = ref<NotifyRecipients>('assignee')
const errorMessage = ref<string | null>(null)

function resetFrom(rule: AutomationRule | null | undefined) {
  trigger.value = rule?.trigger ?? 'task_aging'
  action.value = rule?.action ?? 'notify'
  params.value = Object.fromEntries(
    TRIGGER_PARAM_FIELDS[trigger.value].map(f => [f.key, Number(rule?.triggerParams[f.key] ?? defaultParam(trigger.value, f.key))]),
  )
  recipients.value = (rule?.actionParams.recipients as NotifyRecipients) ?? defaultRecipients(trigger.value)
  errorMessage.value = null
}

function defaultParam(t: AutomationTrigger, key: string): number {
  const d = RuleInputSchema.parse({ trigger: t, triggerParams: {}, action: 'daily_agenda', actionParams: {} })
  return Number(d.triggerParams[key] ?? 0)
}

function defaultRecipients(t: AutomationTrigger): NotifyRecipients {
  return TRIGGER_SUBJECT[t] === 'task' ? 'assignee' : 'scrum_masters'
}

watch(open, (v) => {
  if (v) resetFrom(props.rule)
})

function selectTrigger(t: AutomationTrigger) {
  if (t === trigger.value) return
  trigger.value = t
  params.value = Object.fromEntries(TRIGGER_PARAM_FIELDS[t].map(f => [f.key, defaultParam(t, f.key)]))
  if (!ACTION_ALLOWED_FOR[action.value].includes(TRIGGER_SUBJECT[t])) action.value = 'notify'
  if (recipients.value === 'assignee' && TRIGGER_SUBJECT[t] !== 'task') recipients.value = 'scrum_masters'
}

const triggerItems = AUTOMATION_TRIGGERS.map(t => ({ value: t, ...TRIGGER_INFO[t] }))

const actionItems = computed(() =>
  AUTOMATION_ACTIONS
    .filter(a => ACTION_ALLOWED_FOR[a].includes(TRIGGER_SUBJECT[trigger.value]))
    .map(a => ({ value: a, label: ACTION_INFO[a].label, description: ACTION_INFO[a].hint })),
)

const recipientItems = computed(() =>
  (Object.keys(RECIPIENT_LABEL) as NotifyRecipients[])
    .filter(r => r !== 'assignee' || TRIGGER_SUBJECT[trigger.value] === 'task')
    .map(r => ({ value: r, label: RECIPIENT_LABEL[r] })),
)

const fields = computed(() => TRIGGER_PARAM_FIELDS[trigger.value])

function onSubmit() {
  const candidate = {
    trigger: trigger.value,
    triggerParams: { ...params.value },
    action: action.value,
    actionParams: action.value === 'notify' ? { recipients: recipients.value } : {},
  }
  const parsed = RuleInputSchema.safeParse(candidate)
  if (!parsed.success) {
    errorMessage.value = parsed.error.issues[0]?.message ?? 'Проверь параметры'
    return
  }
  errorMessage.value = null
  emit('submit', parsed.data)
}
</script>

<template>
  <UModal v-model:open="open" :title="rule ? 'Изменить правило' : 'Новое правило'" :ui="{ content: 'max-w-lg' }">
    <template #body>
      <div class="space-y-5">
        <div>
          <p class="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted mb-2">Если</p>
          <div class="grid grid-cols-1 gap-2">
            <button
              v-for="t in triggerItems"
              :key="t.value"
              type="button"
              class="flex items-start gap-3 rounded-xl border p-3 text-left transition-colors cursor-pointer"
              :class="trigger === t.value ? 'border-accent-500 bg-accent-500/5' : 'border-default hover:bg-elevated'"
              @click="selectTrigger(t.value)"
            >
              <UIcon :name="t.icon" class="size-4 mt-0.5 shrink-0" :class="trigger === t.value ? 'text-accent-500' : 'text-muted'" />
              <span class="min-w-0">
                <span class="block text-[13.5px] font-semibold text-default">{{ t.label }}</span>
                <span class="block text-[12px] text-muted leading-snug">{{ t.hint }}</span>
              </span>
            </button>
          </div>
        </div>

        <div v-if="fields.length > 0" class="grid grid-cols-2 gap-3">
          <UFormField v-for="f in fields" :key="f.key" :label="f.label" :hint="`${f.min}–${f.max}`">
            <UInput
              v-model.number="params[f.key]"
              type="number"
              :min="f.min"
              :max="f.max"
              class="w-full"
            >
              <template #trailing>
                <span class="text-xs text-muted">{{ f.suffix }}</span>
              </template>
            </UInput>
          </UFormField>
        </div>

        <div>
          <p class="text-[12px] font-semibold uppercase tracking-[0.06em] text-muted mb-2">То</p>
          <USelect v-model="action" :items="actionItems" class="w-full" />
          <p class="text-[12px] text-muted mt-1.5">{{ ACTION_INFO[action].hint }}</p>
        </div>

        <UFormField v-if="action === 'notify'" label="Кого уведомить">
          <USelect v-model="recipients" :items="recipientItems" class="w-full" />
        </UFormField>

        <UAlert
          v-if="errorMessage"
          color="error"
          variant="soft"
          :title="errorMessage"
          icon="i-lucide-alert-circle"
        />

        <div class="flex justify-end gap-2 pt-1">
          <UButton type="button" variant="ghost" color="neutral" @click="open = false">
            Отмена
          </UButton>
          <UButton :loading="pending" @click="onSubmit">
            {{ rule ? 'Сохранить' : 'Создать' }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
