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

const preview = useQuery({
  queryKey: ['users', 'me', 'deletion-preview'],
  queryFn: () => $fetch<DeletionPreview>(apiRoutes.usersMeDeletionPreview),
})

const password = ref('')
const error = ref<string | null>(null)
const transferTarget = ref<{ id: string, name: string } | null>(null)
const transferOpen = ref(false)

const blockers = computed(() => preview.data.value?.soleOwned ?? [])
const canDelete = computed(() => preview.isSuccess.value && !blockers.value.length && password.value.length > 0)

function count(n: number | undefined, forms: [string, string, string]): string {
  return `${n ?? 0} ${plural(n ?? 0, forms)}`
}

const gone = computed(() => [
  'Профиль, фото и настройки',
  `Членство в ${count(preview.data.value?.memberships, ['воркспейсе', 'воркспейсах', 'воркспейсах'])}`,
  'Твои уведомления и активные сессии',
])
const kept = computed(() => [
  `${count(preview.data.value?.tasksCreated, ['задача', 'задачи', 'задач'])} и ${count(preview.data.value?.comments, ['комментарий', 'комментария', 'комментариев'])}`,
  'Останутся у команды без подписи, автор – «Удалённый пользователь»',
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

    <SettingsTile tone="danger" title="Удалить аккаунт" description="Это навсегда: восстановить аккаунт не получится">
      <div class="grid gap-3 sm:grid-cols-2">
        <div class="rounded-xl border border-default bg-default/60 p-4">
          <p class="mb-2 flex items-center gap-2 text-sm font-semibold text-error">
            <UIcon name="i-hugeicons-delete-02" class="size-4" />
            Исчезнет
          </p>
          <ul class="space-y-1 text-sm text-toned">
            <li v-for="line in gone" :key="line">{{ line }}</li>
          </ul>
        </div>
        <div class="rounded-xl border border-default bg-default/60 p-4">
          <p class="mb-2 flex items-center gap-2 text-sm font-semibold text-success">
            <UIcon name="i-hugeicons-shield-01" class="size-4" />
            Останется у команды
          </p>
          <ul class="space-y-1 text-sm text-toned">
            <li v-for="line in kept" :key="line">{{ line }}</li>
          </ul>
        </div>
      </div>

      <div v-if="blockers.length" class="mt-4 space-y-2">
        <p class="text-sm text-default">Сначала реши, что будет с воркспейсами, где ты единственный владелец:</p>
        <div
          v-for="ws in blockers"
          :key="ws.id"
          class="flex flex-wrap items-center gap-3 rounded-xl border border-warning/40 bg-warning/10 px-3 py-2.5"
        >
          <UIcon name="i-hugeicons-alert-02" class="size-4 shrink-0 text-warning" />
          <span class="min-w-0 flex-1 truncate text-sm text-default">{{ ws.name }}</span>
          <UButton size="xs" variant="soft" color="neutral" @click="openTransfer(ws)">Передать</UButton>
          <UButton size="xs" variant="link" color="error" :to="pageRoutes.workspaceSettings(ws.id, 'delete')">Удалить воркспейс</UButton>
        </div>
      </div>

      <div class="mt-4 grid gap-2 sm:grid-cols-2">
        <UInput v-model="password" type="password" autocomplete="current-password" placeholder="Текущий пароль" :disabled="!!blockers.length" />
        <UiHoldToConfirm
          label="Удерживай, чтобы удалить"
          :disabled="!canDelete"
          :loading="deleteAccount.isPending.value"
          @confirm="onDelete"
        />
      </div>
      <p v-if="error" class="mt-2 text-sm text-error">{{ error }}</p>
    </SettingsTile>

    <SettingsTransferOwnershipModal v-model:open="transferOpen" :workspace="transferTarget" @done="preview.refetch()" />
  </div>
</template>
