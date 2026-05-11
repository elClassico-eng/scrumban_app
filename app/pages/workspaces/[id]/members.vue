<script setup lang="ts">
import type { Role } from '#shared/types/domain'

const route = useRoute()
const wsId = computed(() => route.params.id as string)

const { list: workspacesList } = useWorkspacesApi()
const { list: membersList, updateRole, remove } = useMembersApi(wsId)

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const members = computed(() => membersList.data.value?.members ?? [])

useHead({
  title: () => workspace.value
    ? `${workspace.value.name} — Участники`
    : 'Участники — Scrumban',
})

const canManage = computed(() => hasRole(workspace.value?.role, 'admin'))
const myRole = computed(() => workspace.value?.role)

// Roles available for assignment — only those strictly below the actor's role.
function rolesAssignableBy(actor: Role | undefined): Array<{ label: string; value: Role }> {
  const all: Array<{ label: string; value: Role }> = [
    { label: 'Наблюдатель', value: 'viewer' },
    { label: 'Участник', value: 'member' },
    { label: 'Скрам-мастер', value: 'scrum_master' },
    { label: 'Администратор', value: 'admin' },
    { label: 'Владелец', value: 'owner' },
  ]
  if (!actor) return []
  const ORDER: Record<Role, number> = {
    viewer: 0, member: 1, scrum_master: 2, admin: 3, owner: 4,
  }
  return all.filter(o => ORDER[o.value] < ORDER[actor])
}

const addOpen = ref(false)

const actionError = ref<string | null>(null)

async function onRoleChange(userId: string, newRole: Role) {
  actionError.value = null
  try {
    await updateRole.mutateAsync({ userId, role: newRole })
  }
  catch (err) {
    const e = err as { statusCode?: number; data?: { message?: string } }
    if (e?.statusCode === 400) actionError.value = e.data?.message ?? 'Нельзя понизить последнего владельца'
    else if (e?.statusCode === 403) actionError.value = 'У тебя нет прав на это изменение'
    else actionError.value = 'Не удалось обновить роль'
  }
}

const confirm = useConfirm()

async function onRemove(userId: string, email: string) {
  actionError.value = null
  const ok = await confirm({
    title: `Удалить ${email} из workspace?`,
    description: 'Пользователь потеряет доступ ко всем доскам этого workspace.',
    confirmLabel: 'Удалить',
    confirmColor: 'error',
  })
  if (!ok) return
  try {
    await remove.mutateAsync(userId)
  }
  catch (err) {
    const e = err as { statusCode?: number; data?: { message?: string } }
    if (e?.statusCode === 400) actionError.value = e.data?.message ?? 'Нельзя удалить последнего владельца'
    else if (e?.statusCode === 403) actionError.value = 'У тебя нет прав удалить этого участника'
    else actionError.value = 'Не удалось удалить участника'
  }
}
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold tracking-tight">Участники</h1>
        <p class="text-sm text-muted mt-1">
          {{ workspace?.name ? `Workspace: ${workspace.name}` : 'Кто состоит в этом workspace' }}
        </p>
      </div>
      <UButton
        v-if="canManage"
        icon="i-lucide-user-plus"
        @click="addOpen = true"
      >
        Добавить участника
      </UButton>
    </div>

    <UAlert
      v-if="actionError"
      color="error"
      variant="soft"
      :title="actionError"
      icon="i-lucide-alert-circle"
      :close="{ onClick: () => { actionError = null } }"
    />

    <div v-if="membersList.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <UCard v-else>
      <div class="divide-y divide-default">
        <div
          v-for="member in members"
          :key="member.userId"
          class="flex items-center gap-4 py-3 first:pt-0 last:pb-0"
        >
          <div class="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-medium uppercase text-sm">
            {{ member.email.slice(0, 1) }}
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium truncate">{{ member.email }}</p>
            <p class="text-xs text-muted">
              В workspace с {{ new Date(member.createdAt).toLocaleDateString('ru') }}
            </p>
          </div>
          <div class="flex items-center gap-2">
            <template v-if="canManage && rolesAssignableBy(myRole).length > 0">
              <USelect
                :model-value="member.role"
                :items="rolesAssignableBy(myRole)"
                size="sm"
                @update:model-value="(v: Role) => onRoleChange(member.userId, v)"
              />
              <UButton
                icon="i-lucide-trash-2"
                color="neutral"
                variant="ghost"
                size="sm"
                :loading="remove.isPending.value"
                @click="onRemove(member.userId, member.email)"
              />
            </template>
            <WorkspaceMemberRoleBadge v-else :role="member.role" />
          </div>
        </div>
      </div>
    </UCard>

    <WorkspaceAddMemberModal v-if="canManage" v-model:open="addOpen" :workspace-id="wsId" />
  </div>
</template>