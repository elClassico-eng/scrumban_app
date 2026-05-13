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

const editingId = ref<string | null>(null)
function startEdit(id: string) {
  editingId.value = id
}
function stopEdit() {
  editingId.value = null
}

const ROLE_LABEL: Record<Role, string> = {
  viewer: 'Наблюдатель',
  member: 'Участник',
  scrum_master: 'Скрам-мастер',
  admin: 'Администратор',
  owner: 'Владелец',
}

const confirm = useConfirm()

async function onRoleChange(userId: string, currentRole: Role, newRole: Role) {
  if (newRole === currentRole) return
  actionError.value = null
  const ok = await confirm({
    title: `Изменить роль на «${ROLE_LABEL[newRole]}»?`,
    description: `Текущая роль — «${ROLE_LABEL[currentRole]}». Пользователь получит все права новой роли.`,
    confirmLabel: 'Изменить',
  })
  if (!ok) return
  try {
    await updateRole.mutateAsync({ userId, role: newRole })
    stopEdit()
  }
  catch (err) {
    actionError.value = getErrorMessage(err, 'Не удалось обновить роль')
  }
}

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
    stopEdit()
  }
  catch (err) {
    actionError.value = getErrorMessage(err, 'Не удалось удалить участника')
  }
}
</script>

<template>
  <div class="space-y-6">
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
        class="py-2.5"
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

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <div
        v-for="member in members"
        :key="member.userId"
        class="glass-strong rounded-xl p-4 flex flex-col gap-3 transition-all hover:shadow-md"
      >
        <div class="flex items-center gap-3">
          <div class="size-10 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm shrink-0 overflow-hidden">
            <img
              v-if="member.avatarUrl"
              :src="member.avatarUrl"
              alt=""
              class="size-full object-cover"
            >
            <span v-else>{{ initials(member) }}</span>
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-semibold text-sm truncate text-default">{{ displayName(member) }}</p>
            <p class="text-xs text-muted truncate">
              {{ member.jobTitle || member.email }}
            </p>
          </div>
          <UButton
            v-if="canManage && canEditMember(myRole, member.role) && editingId !== member.userId"
            icon="i-lucide-pencil"
            color="neutral"
            variant="ghost"
            size="xs"
            title="Редактировать"
            @click="startEdit(member.userId)"
          />
          <UButton
            v-else-if="editingId === member.userId"
            icon="i-lucide-x"
            color="neutral"
            variant="ghost"
            size="xs"
            title="Готово"
            @click="stopEdit"
          />
        </div>

        <div class="flex items-center justify-between gap-2">
          <template v-if="editingId === member.userId && canManage && canEditMember(myRole, member.role)">
            <USelect
              :model-value="member.role"
              :items="rolesAssignableBy(myRole)"
              size="xs"
              class="flex-1"
              @update:model-value="(v: Role) => onRoleChange(member.userId, member.role, v)"
            />
            <UButton
              icon="i-lucide-trash-2"
              color="error"
              variant="ghost"
              size="xs"
              :loading="remove.isPending.value"
              title="Удалить из workspace"
              @click="onRemove(member.userId, member.email)"
            />
          </template>
          <template v-else>
            <WorkspaceMemberRoleBadge :role="member.role" />
            <span class="text-[11px] text-muted">
              c {{ new Date(member.createdAt).toLocaleDateString('ru', { day: '2-digit', month: 'short' }) }}
            </span>
          </template>
        </div>
      </div>
    </div>

    <WorkspaceAddMemberModal v-if="canManage" v-model:open="addOpen" :workspace-id="wsId" />
  </div>
</template>