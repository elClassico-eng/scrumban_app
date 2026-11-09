<script setup lang="ts">
import { pageRoutes } from '~/routing'

const { current: workspace } = useSettingsWorkspace()
const { remove } = useWorkspacesApi()
const usage = useStorageUsageApi(computed(() => workspace.value?.id ?? null))
const router = useRouter()
const toast = useToast()
const confirmName = ref('')

const armed = computed(() => !!workspace.value && confirmName.value.trim() === workspace.value.name)

function count(n: number, forms: [string, string, string]): string {
  return `${n} ${plural(n, forms)}`
}

const losses = computed(() => {
  const w = workspace.value
  if (!w) return []
  return [
    count(w.boardCount, ['доска', 'доски', 'досок']),
    `${count(w.openTaskCount, ['открытая задача', 'открытые задачи', 'открытых задач'])} и вся история`,
    `${formatBytes(usage.data.value?.usedBytes ?? 0)} файлов`,
    `доступ у ${count(w.memberCount, ['участника', 'участников', 'участников'])}`,
  ]
})

async function onDelete() {
  if (!workspace.value || !armed.value) return
  try {
    await remove.mutateAsync(workspace.value.id)
    await router.push(pageRoutes.workspaces)
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось удалить воркспейс'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }
}
</script>

<template>
  <SettingsTile v-if="workspace" :title="`Удалить «${workspace.name}»`" description="Восстановить его потом не получится. Вот что пропадёт у всей команды">
    <ul class="grid gap-2 sm:grid-cols-2">
      <li v-for="line in losses" :key="line" class="flex items-center gap-2.5 rounded-xl bg-zinc-50 dark:bg-elevated/60 px-3 py-2.5 text-sm text-default">
        <UIcon name="i-hugeicons-delete-02" class="size-4 shrink-0 text-muted" />
        {{ line }}
      </li>
    </ul>
    <div class="mt-4 grid gap-2 sm:grid-cols-2">
      <UInput v-model="confirmName" :placeholder="`Введите «${workspace.name}»`" autocomplete="off" />
      <UiHoldToConfirm label="Удерживайте, чтобы удалить" :disabled="!armed" disabled-hint="Введите название воркспейса" :loading="remove.isPending.value" @confirm="onDelete" />
    </div>
  </SettingsTile>
</template>
