<script setup lang="ts">
import { useQuery } from '@tanstack/vue-query'
import { apiRoutes, pageRoutes } from '~/routing'

type DeletionPreview = {
  memberships: number
  tasksCreated: number
  comments: number
  soleOwned: { id: string, name: string }[]
}

const { logout } = useAuthApi()
const { me, deleteAccount } = useProfileApi()
const { list: workspacesList } = useWorkspacesApi()

const preview = useQuery({
  queryKey: ['users', 'me', 'deletion-preview'],
  queryFn: () => $fetch<DeletionPreview>(apiRoutes.usersMeDeletionPreview),
})

const password = ref('')
const error = ref<string | null>(null)
const transferTarget = ref<{ id: string, name: string } | null>(null)
const transferOpen = ref(false)

const blockers = computed(() => {
  const all = workspacesList.data.value?.workspaces ?? []
  return (preview.data.value?.soleOwned ?? []).map(ws => ({ ...ws, details: all.find(w => w.id === ws.id) }))
})
const ready = computed(() => preview.isSuccess.value && !blockers.value.length)
const canDelete = computed(() => ready.value && password.value.length > 0)

function count(n: number | undefined, forms: [string, string, string]): string {
  return `${n ?? 0} ${plural(n ?? 0, forms)}`
}

const gone = computed(() => [
  { icon: 'i-hugeicons-user', text: 'Профиль, фото и настройки' },
  { icon: 'i-hugeicons-user-group', text: `Доступ к ${count(preview.data.value?.memberships, ['воркспейсу', 'воркспейсам', 'воркспейсам'])}` },
  { icon: 'i-hugeicons-notification-02', text: 'Уведомления и активные сессии' },
])
const kept = computed(() => [
  { icon: 'i-hugeicons-task-01', text: count(preview.data.value?.tasksCreated, ['созданная задача', 'созданные задачи', 'созданных задач']) },
  { icon: 'i-hugeicons-comment-01', text: count(preview.data.value?.comments, ['комментарий', 'комментария', 'комментариев']) },
  { icon: 'i-hugeicons-user-question-01', text: 'Автором станет «Удалённый пользователь»' },
])

function openTransfer(ws: { id: string, name: string }) {
  transferTarget.value = ws
  transferOpen.value = true
}

async function onDelete() {
  error.value = null
  try {
    await deleteAccount.mutateAsync({ password: password.value })
    window.location.href = pageRoutes.login
  }
  catch (err) {
    error.value = getErrorMessage(err, 'Не удалось удалить аккаунт')
  }
}
</script>

<template>
  <div class="space-y-4">
    <SettingsTile>
      <div class="flex items-center justify-between gap-4">
        <div class="min-w-0">
          <p class="font-semibold text-default">Выйти из аккаунта</p>
          <p class="truncate text-sm text-muted">{{ me.data.value?.user.email }} · данные останутся на месте</p>
        </div>
        <UButton color="neutral" variant="soft" icon="i-hugeicons-logout-01" :loading="logout.isPending.value" @click="logout.mutate()">
          Выйти
        </UButton>
      </div>
    </SettingsTile>

    <SettingsTile title="Удалить аккаунт" description="Восстановить его потом не получится, поэтому сначала посмотрите, что изменится">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl bg-elevated/60 p-4">
          <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-error">Исчезнет</p>
          <ul class="space-y-2.5">
            <li v-for="line in gone" :key="line.text" class="flex items-center gap-2.5 text-sm text-default">
              <UIcon :name="line.icon" class="size-4 shrink-0 text-muted" />
              {{ line.text }}
            </li>
          </ul>
        </div>
        <div class="rounded-xl bg-elevated/60 p-4">
          <p class="mb-3 text-xs font-semibold uppercase tracking-wide text-success">Останется у команды</p>
          <ul class="space-y-2.5">
            <li v-for="line in kept" :key="line.text" class="flex items-center gap-2.5 text-sm text-default">
              <UIcon :name="line.icon" class="size-4 shrink-0 text-muted" />
              {{ line.text }}
            </li>
          </ul>
        </div>
      </div>

      <div v-if="blockers.length" class="mt-6">
        <div class="mb-3 flex items-baseline justify-between gap-3">
          <p class="text-sm font-semibold text-default">Сначала передайте воркспейсы</p>
          <p class="text-xs text-muted">вы в них единственный владелец</p>
        </div>
        <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div
            v-for="ws in blockers"
            :key="ws.id"
            class="flex flex-col gap-4 rounded-xl border border-default bg-default p-4 transition-shadow hover:shadow-sm"
          >
            <div class="flex items-center gap-3">
              <WorkspaceAvatar :name="ws.name" :logo-url="ws.details?.logoUrl" size="md" />
              <div class="min-w-0">
                <p class="truncate font-medium text-default">{{ ws.name }}</p>
                <p class="text-xs text-muted">
                  {{ ws.details ? count(ws.details.memberCount, ['участник', 'участника', 'участников']) : 'Воркспейс' }}
                </p>
              </div>
            </div>
            <div class="mt-auto flex items-center gap-2">
              <UTooltip :text="ws.details?.memberCount === 1 ? 'Вы тут один – пригласите коллегу или удалите воркспейс' : undefined" :disabled="ws.details?.memberCount !== 1" class="flex-1">
                <UButton
                  size="sm"
                  color="neutral"
                  icon="i-hugeicons-user-switch"
                  class="w-full justify-center"
                  :disabled="ws.details?.memberCount === 1"
                  @click="openTransfer(ws)"
                >
                  Передать
                </UButton>
              </UTooltip>
              <UTooltip text="Удалить воркспейс">
                <UButton
                  size="sm"
                  color="error"
                  variant="soft"
                  icon="i-hugeicons-delete-02"
                  aria-label="Удалить воркспейс"
                  :to="pageRoutes.workspaceSettings(ws.id, 'delete')"
                />
              </UTooltip>
            </div>
          </div>
        </div>
      </div>

      <div class="mt-6 border-t border-default pt-5">
        <p class="mb-3 text-sm font-semibold text-default">Подтвердите удаление</p>
        <div class="grid gap-2 sm:grid-cols-2">
          <UInput
            v-model="password"
            type="password"
            autocomplete="current-password"
            placeholder="Текущий пароль"
            icon="i-hugeicons-lock-password"
            :disabled="!ready"
          />
          <UiHoldToConfirm
            label="Удерживайте, чтобы удалить"
            :disabled="!canDelete"
            :disabled-hint="ready ? 'Введите пароль' : 'Сначала передайте воркспейсы'"
            :loading="deleteAccount.isPending.value"
            @confirm="onDelete"
          />
        </div>
        <p v-if="error" class="mt-2 text-sm text-error">{{ error }}</p>
      </div>
    </SettingsTile>

    <SettingsTransferOwnershipModal v-model:open="transferOpen" :workspace="transferTarget" @done="preview.refetch()" />
  </div>
</template>
