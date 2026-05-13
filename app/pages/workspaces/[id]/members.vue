<script setup lang="ts">
import type { Role } from '#shared/types/domain'

const route = useRoute()
const wsId = computed(() => route.params.id as string)

const { list: workspacesList, update: updateWorkspace } = useWorkspacesApi()
const { list: membersList, updateRole, remove } = useMembersApi(wsId)
const toast = useToast()

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

// Inline-rename for the workspace label. Same dblclick + Enter/blur
// pattern as BoardSubnav.
const isEditingName = ref(false)
const draftName = ref('')
const nameInputRef = ref<HTMLInputElement | null>(null)

function startEditName() {
  if (!canManage.value || !workspace.value) return
  draftName.value = workspace.value.name
  isEditingName.value = true
  nextTick(() => nameInputRef.value?.focus())
}

function cancelEditName() {
  isEditingName.value = false
  draftName.value = ''
}

async function commitEditName() {
  const trimmed = draftName.value.trim()
  if (!trimmed || !workspace.value || trimmed === workspace.value.name) {
    cancelEditName()
    return
  }
  try {
    await updateWorkspace.mutateAsync({ workspaceId: wsId.value, name: trimmed })
    isEditingName.value = false
  }
  catch {
    toast.add({
      title: 'Не удалось переименовать workspace',
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const ROLE_ORDER: Record<Role, number> = {
  viewer: 0, member: 1, scrum_master: 2, admin: 3, owner: 4,
}

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
  return all.filter(o => ROLE_ORDER[o.value] < ROLE_ORDER[actor])
}

// Member is editable when the actor strictly outranks them. Without this
// guard, an admin viewing an owner would see the role rendered as the raw
// enum value ("owner") because USelect can't find a matching item.
function canEditMember(actor: Role | undefined, target: Role): boolean {
  if (!actor) return false
  return ROLE_ORDER[actor] > ROLE_ORDER[target]
}

const addOpen = ref(false)

const actionError = ref<string | null>(null)

async function onRoleChange(userId: string, newRole: Role) {
  actionError.value = null
  try {
    await updateRole.mutateAsync({ userId, role: newRole })
  }
  catch (err) {
    actionError.value = getErrorMessage(err, 'Не удалось обновить роль')
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
    actionError.value = getErrorMessage(err, 'Не удалось удалить участника')
  }
}
</script>

<template>
  <div class="space-y-6 max-w-4xl">
    <div class="flex items-center justify-between">
      <div class="min-w-0">
        <h1 class="text-2xl font-bold tracking-tight">Участники</h1>
        <p v-if="!workspace" class="text-sm text-muted mt-1">
          Кто состоит в этом workspace
        </p>
        <div v-else class="text-sm text-muted mt-1 flex items-center gap-1.5">
          <span>Workspace:</span>
          <input
            v-if="isEditingName"
            ref="nameInputRef"
            v-model="draftName"
            class="text-sm font-medium text-default bg-transparent border-b border-primary outline-none min-w-0"
            :disabled="updateWorkspace.isPending.value"
            @keyup.enter="commitEditName"
            @keyup.esc="cancelEditName"
            @blur="commitEditName"
          >
          <span
            v-else
            class="font-medium text-default"
            :class="canManage ? 'cursor-text hover:text-primary transition-colors' : ''"
            :title="canManage ? 'Двойной клик — переименовать' : ''"
            @dblclick="startEditName"
          >{{ workspace.name }}</span>
        </div>
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
            <template v-if="canManage && canEditMember(myRole, member.role)">
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