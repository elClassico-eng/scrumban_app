<script setup lang="ts">
import type { AutomationRule, AutomationTrigger, RuleInput } from '#shared/types/automation'
import { TRIGGER_INFO } from '~/utils/automation-labels'

const route = useRoute()
const wsId = computed(() => route.params.id as string)
const bId = computed(() => route.params.boardId as string)

const workspaceStore = useWorkspaceStore()
workspaceStore.setCurrent(wsId.value)

const { list: workspacesList } = useWorkspacesApi()
const { list: boardsList } = useBoardsApi(wsId)
const { rules, create, update, remove, run } = useAutomationsApi(wsId, bId)

const toast = useToast()
const confirm = useConfirm()

const workspace = computed(() => workspacesList.data.value?.workspaces.find(w => w.id === wsId.value))
const board = computed(() => boardsList.data.value?.boards.find(b => b.id === bId.value))
const canManage = computed(() => hasRole(workspace.value?.role, 'scrum_master'))
const canRenameBoard = computed(() => hasRole(workspace.value?.role, 'admin'))

useHead({
  title: () => board.value ? `${board.value.name} — Автоматизации` : 'Автоматизации — Такт',
})

const items = computed(() => rules.data.value?.rules ?? [])

const STEPS = [
  { title: 'Условие из математики', text: 'Не «перенесли задачу», а «задача висит дольше 85% SLE» или «шанс закрыть спринт ниже 70%». Порог задаёшь сам.' },
  { title: 'Действие', text: 'Уведомить исполнителя или скрам-мастеров, оставить комментарий в задаче, вынести в повестку daily.' },
  { title: 'Эпизод, не спам', text: 'Такт проверяет доску раз в час. Пока условие держится, правило не повторяется; когда проблема ушла, срабатывание закрывается само.' },
]

const TRIGGERS = (Object.keys(TRIGGER_INFO) as AutomationTrigger[]).map(key => ({ key, ...TRIGGER_INFO[key] }))
const burning = computed(() => items.value.reduce((n, r) => n + r.openFirings, 0))

const modalOpen = ref(false)
const editing = ref<AutomationRule | null>(null)

function openCreate() {
  editing.value = null
  modalOpen.value = true
}

function openEdit(rule: AutomationRule) {
  editing.value = rule
  modalOpen.value = true
}

function fail(err: unknown, fallback: string) {
  toast.add({ title: getErrorMessage(err, fallback), color: 'error', icon: 'i-lucide-alert-circle' })
}

async function onSubmit(input: RuleInput) {
  try {
    if (editing.value) await update.mutateAsync({ ruleId: editing.value.id, ...input })
    else await create.mutateAsync(input)
    modalOpen.value = false
  }
  catch (err) {
    fail(err, 'Не удалось сохранить правило')
  }
}

async function onToggle(rule: AutomationRule, enabled: boolean) {
  try {
    await update.mutateAsync({ ruleId: rule.id, enabled })
  }
  catch (err) {
    fail(err, 'Не удалось изменить правило')
  }
}

async function onRemove(rule: AutomationRule) {
  const ok = await confirm({
    title: 'Удалить правило?',
    description: 'Открытые срабатывания этого правила тоже исчезнут.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  try {
    await remove.mutateAsync(rule.id)
  }
  catch (err) {
    fail(err, 'Не удалось удалить правило')
  }
}

async function onRun() {
  try {
    const r = await run.mutateAsync()
    toast.add({
      title: 'Проверка выполнена',
      description: `Новых срабатываний: ${r.opened}, закрыто: ${r.resolved}`,
      icon: 'i-lucide-zap',
    })
  }
  catch (err) {
    fail(err, 'Не удалось запустить проверку')
  }
}
</script>

<template>
  <div class="flex flex-col h-full min-h-0">
    <BoardSubnav :workspace-id="wsId" :board-id="bId" :board-name="board?.name" :can-rename="canRenameBoard" :board="board" />

    <div class="flex-1 min-h-0 overflow-y-auto pt-4 pb-8 space-y-5">
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 class="m-0 text-2xl font-semibold tracking-tight text-default sm:text-[28px]">Автоматизации</h1>
          <p class="text-sm text-muted">Если математика видит проблему, система действует сама</p>
        </div>
        <div v-if="canManage" class="flex items-center gap-2">
          <UButton
            icon="i-lucide-play"
            color="neutral"
            variant="outline"
            :loading="run.isPending.value"
            @click="onRun"
          >
            Проверить сейчас
          </UButton>
          <UButton icon="i-lucide-plus" @click="openCreate">
            Правило
          </UButton>
        </div>
      </div>

      <div
        v-if="burning > 0"
        class="flex items-center gap-2 text-[13px] text-red-600 dark:text-red-300"
      >
        <UIcon name="i-lucide-flame" class="size-4" />
        Сейчас горит {{ burning }} {{ burning === 1 ? 'срабатывание' : 'срабатываний' }}
      </div>

      <div v-if="rules.isLoading.value" class="h-32 flex items-center justify-center text-muted">
        <UIcon name="i-lucide-loader" class="animate-spin size-6" />
      </div>

      <div v-else-if="items.length === 0" class="space-y-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div
            v-for="(step, i) in STEPS"
            :key="step.title"
            class="surface rounded-2xl p-5 flex gap-4"
          >
            <span class="size-8 rounded-full grid place-items-center shrink-0 bg-accent-500 text-white text-[13px] font-semibold tabular-nums">
              {{ i + 1 }}
            </span>
            <div class="min-w-0">
              <p class="m-0 text-[15px] font-semibold text-default leading-snug">{{ step.title }}</p>
              <p class="m-0 mt-1 text-[13px] text-muted leading-relaxed">{{ step.text }}</p>
            </div>
          </div>
        </div>

        <div>
          <p class="text-[11px] font-semibold uppercase tracking-[0.06em] text-muted mb-2">Что умеет отслеживать</p>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div
              v-for="t in TRIGGERS"
              :key="t.key"
              class="bg-default border border-default rounded-xl p-4 space-y-2"
            >
              <UIcon :name="t.icon" class="size-4 text-accent-500" />
              <p class="m-0 text-[13.5px] font-semibold text-default leading-snug">{{ t.label }}</p>
              <p class="m-0 text-[12px] text-muted leading-relaxed">{{ t.hint }}</p>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center gap-3">
          <UButton v-if="canManage" icon="i-lucide-plus" @click="openCreate">
            Добавить правило
          </UButton>
          <p class="m-0 text-[12.5px] text-muted">
            {{ canManage ? 'Правила проверяются раз в час; пока условие держится, повторов нет.' : 'Добавлять правила может скрам-мастер или администратор.' }}
          </p>
        </div>
      </div>

      <div v-else class="space-y-3">
        <AutomationRuleRow
          v-for="r in items"
          :key="r.id"
          :rule="r"
          :can-manage="canManage"
          :busy="update.isPending.value"
          @toggle="(v) => onToggle(r, v)"
          @edit="openEdit(r)"
          @remove="onRemove(r)"
        />
      </div>
    </div>

    <AutomationRuleModal
      v-model:open="modalOpen"
      :rule="editing"
      :pending="create.isPending.value || update.isPending.value"
      @submit="onSubmit"
    />
  </div>
</template>
