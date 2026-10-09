<script setup lang="ts">
import type { AutomationRule, RuleInput } from '#shared/types/automation'

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

      <div v-else-if="items.length === 0" class="bg-default border border-default rounded-2xl p-6 sm:p-8 max-w-2xl">
        <div class="flex items-start gap-4">
          <span class="size-10 rounded-xl grid place-items-center shrink-0 bg-accent-500/10 text-accent-500">
            <UIcon name="i-lucide-zap" class="size-5" />
          </span>
          <div class="space-y-4 min-w-0">
            <div>
              <h2 class="m-0 text-lg font-semibold text-default">Правил пока нет</h2>
              <p class="text-sm text-muted mt-1">
                Правило – это «если … → то …». Условия берутся из математики доски, а не из ручных событий:
                задача висит в колонке дольше SLE, блокер держится несколько дней, шанс закрыть спринт упал ниже порога,
                колонка над WIP-лимитом, бэклог давно не пополняли.
              </p>
            </div>
            <ol class="text-sm text-default space-y-2 list-decimal pl-5 marker:text-muted">
              <li>Выбираешь условие и его порог, например «задача в колонке дольше 85% SLE».</li>
              <li>Выбираешь, что сделать: уведомить исполнителя или скрам-мастеров, оставить комментарий в задаче, вынести в повестку daily.</li>
              <li>Такт проверяет доску раз в час. Пока условие держится, правило не повторяется; когда проблема ушла, срабатывание закрывается само.</li>
            </ol>
            <p class="text-xs text-muted">Для условий по SLE нужен рассчитанный SLE доски, для прогноза спринта – активный спринт с историей закрытых задач.</p>
            <div v-if="canManage" class="flex flex-wrap gap-2 pt-1">
              <UButton icon="i-lucide-plus" @click="openCreate">
                Добавить правило
              </UButton>
            </div>
            <p v-else class="text-xs text-muted">Добавлять правила может скрам-мастер или администратор.</p>
          </div>
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
