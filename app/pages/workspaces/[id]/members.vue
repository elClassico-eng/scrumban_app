<script setup lang="ts">
import { useMediaQuery } from '@vueuse/core'
import type { Role } from '#shared/types/domain'

const route = useRoute()
const wsId = computed(() => route.params.id as string)

const { list: workspacesList } = useWorkspacesApi()
const { list: membersList, updateRole, remove } = useMembersApi(wsId)
const { list: invitationsList } = useInvitationsApi(wsId)
const authStore = useAuthStore()
const toast = useToast()
const confirm = useConfirm()

const workspace = computed(() =>
  workspacesList.data.value?.workspaces.find(w => w.id === wsId.value),
)
const members = computed(() => membersList.data.value?.members ?? [])
const invitations = computed(() => invitationsList.data.value?.invitations ?? [])

useHead({
  title: () => workspace.value
    ? `${workspace.value.name} — Участники`
    : 'Участники — Scrumban',
})

const canManage = computed(() => hasRole(workspace.value?.role, 'admin'))
const myRole = computed(() => workspace.value?.role)
const currentUserId = computed(() => authStore.user?.id ?? null)

const query = ref('')
const roleFilter = ref<Role | 'all'>('all')
const view = ref<'grid' | 'list'>('grid')

const isMobile = useMediaQuery('(max-width: 639px)')
const effectiveView = computed(() => (isMobile.value ? 'grid' : view.value))

const counts = computed(() => {
  const c: Record<Role | 'all', number> = {
    all: members.value.length,
    viewer: 0, member: 0, scrum_master: 0, admin: 0, owner: 0,
  }
  for (const m of members.value) c[m.role] = (c[m.role] ?? 0) + 1
  return c
})

const adminsCount = computed(() => counts.value.admin + counts.value.owner)
const viewersCount = computed(() => counts.value.viewer)

const filteredMembers = computed(() => {
  const q = query.value.trim().toLowerCase()
  return members.value.filter((m) => {
    if (roleFilter.value !== 'all' && m.role !== roleFilter.value) return false
    if (!q) return true
    const hay = `${displayName(m)} ${m.email} ${m.jobTitle ?? ''}`.toLowerCase()
    return hay.includes(q)
  })
})

const inviteOpen = ref(false)
const editingId = ref<string | null>(null)
const actionError = ref<string | null>(null)

function startEdit(id: string) { editingId.value = id }
function stopEdit() { editingId.value = null }

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
    toast.add({
      title: `Роль обновлена: ${ROLE_LABEL[newRole]}`,
      color: 'success',
      icon: 'i-lucide-check',
      duration: 4000,
    })
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
    toast.add({
      title: `${email} удалён из workspace`,
      color: 'success',
      icon: 'i-lucide-check',
      duration: 4000,
    })
  }
  catch (err) {
    actionError.value = getErrorMessage(err, 'Не удалось удалить участника')
  }
}
</script>

<template>
  <div class="space-y-6">
    <WorkspaceMembersHeader
      v-if="workspace"
      :workspace-name="workspace.name"
      :total-count="counts.all"
      :can-invite="canManage"
      @invite="inviteOpen = true"
    />

    <WorkspaceMembersStatsStrip
      :total="counts.all"
      :admins-count="adminsCount"
      :viewers-count="viewersCount"
      :pending-invites="invitations.length"
      :active-filter="roleFilter"
      @update:active-filter="(r) => (roleFilter = r)"
    />

    <UAlert
      v-if="actionError"
      color="error"
      variant="soft"
      :title="actionError"
      icon="i-lucide-alert-circle"
      :close="{ onClick: () => { actionError = null } }"
    />

    <WorkspaceMembersToolbar
      v-model:query="query"
      v-model:role-filter="roleFilter"
      v-model:view="view"
      :counts="counts"
    />

    <div v-if="membersList.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <div
      v-else-if="filteredMembers.length === 0"
      class="rounded-xl border border-dashed border-default p-10 text-center space-y-2"
    >
      <UIcon name="i-lucide-search-x" class="size-8 text-muted mx-auto" />
      <p class="text-sm text-default font-medium">Никого не нашлось</p>
      <p class="text-xs text-muted">Сбросьте фильтры или измените запрос</p>
    </div>

    <div v-else-if="effectiveView === 'list'" class="rounded-xl border border-default bg-default overflow-hidden">
      <div class="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_170px_64px_36px] items-center gap-4 px-4 py-2 border-b border-default text-[11px] uppercase tracking-wide text-muted font-semibold">
        <div>Участник</div>
        <div>Должность</div>
        <div>Роль</div>
        <div>С</div>
        <div />
      </div>
      <div class="divide-y divide-default">
        <WorkspaceMembersMemberListRow
          v-for="m in filteredMembers"
          :key="m.userId"
          :member="m"
          :is-you="m.userId === currentUserId"
          :can-edit="canManage && canEditMemberRole(myRole, m.role)"
          :is-editing="editingId === m.userId"
          :my-role="myRole"
          :remove-loading="remove.isPending.value"
          @start-edit="startEdit(m.userId)"
          @stop-edit="stopEdit"
          @change-role="(v) => onRoleChange(m.userId, m.role, v)"
          @remove="onRemove(m.userId, m.email)"
        />
      </div>
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
      <WorkspaceMembersMemberCard
        v-for="m in filteredMembers"
        :key="m.userId"
        :member="m"
        :is-you="m.userId === currentUserId"
        :can-edit="canManage && canEditMemberRole(myRole, m.role)"
        :is-editing="editingId === m.userId"
        :my-role="myRole"
        :remove-loading="remove.isPending.value"
        @start-edit="startEdit(m.userId)"
        @stop-edit="stopEdit"
        @change-role="(v) => onRoleChange(m.userId, m.role, v)"
        @remove="onRemove(m.userId, m.email)"
      />
    </div>

    <WorkspaceInvitationsSection v-if="canManage" :workspace-id="wsId" />

    <WorkspaceInviteModal
      v-if="canManage"
      v-model:open="inviteOpen"
      :workspace-id="wsId"
      :workspace-name="workspace?.name ?? ''"
    />
  </div>
</template>
