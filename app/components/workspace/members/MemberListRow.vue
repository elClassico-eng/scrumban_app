<script setup lang="ts">
import type { Role } from '#shared/types/domain'

type MemberView = {
  userId: string
  email: string
  firstName: string | null
  lastName: string | null
  middleName: string | null
  avatarUrl: string | null
  jobTitle: string | null
  role: Role
  createdAt: string | Date
}

const props = defineProps<{
  member: MemberView
  isYou: boolean
  canEdit: boolean
  isEditing: boolean
  myRole: Role | undefined
  removeLoading: boolean
}>()

const emit = defineEmits<{
  startEdit: []
  stopEdit: []
  changeRole: [Role]
  remove: []
}>()

const MONTHS = ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек']

const since = computed(() => {
  const d = new Date(props.member.createdAt)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
})

const roleOptions = computed(() => roleOptionsBelow(props.myRole))
</script>

<template>
  <div class="grid grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_170px_64px_36px] items-center gap-4 px-4 py-3 text-sm">
    <div class="flex items-center gap-3 min-w-0">
      <UserAvatar :user="member" size="sm" />
      <div class="min-w-0">
        <div class="flex items-center gap-1.5">
          <p class="font-medium text-default truncate">{{ displayName(member) }}</p>
          <span
            v-if="isYou"
            class="text-[10px] font-bold tracking-wider text-accent-600 uppercase"
          >Вы</span>
        </div>
        <p class="text-xs text-muted truncate">{{ member.email }}</p>
      </div>
    </div>

    <div class="text-xs text-muted truncate">{{ member.jobTitle || '—' }}</div>

    <div>
      <USelect
        v-if="isEditing && canEdit"
        :model-value="member.role"
        :items="roleOptions"
        size="xs"
        class="w-full"
        @update:model-value="(v: Role) => emit('changeRole', v)"
      />
      <WorkspaceMembersRoleChip v-else :role="member.role" />
    </div>

    <div class="text-xs text-muted tabular-nums">
      <template v-if="isEditing && canEdit">
        <UButton
          icon="i-lucide-trash-2"
          color="error"
          variant="ghost"
          size="xs"
          :loading="removeLoading"
          title="Удалить из workspace"
          @click="emit('remove')"
        />
      </template>
      <template v-else>{{ since }}</template>
    </div>

    <div class="flex justify-end">
      <UButton
        v-if="isEditing && canEdit"
        icon="i-lucide-x"
        color="neutral"
        variant="ghost"
        size="xs"
        title="Готово"
        @click="emit('stopEdit')"
      />
      <UButton
        v-else-if="canEdit"
        icon="i-lucide-pencil"
        color="neutral"
        variant="ghost"
        size="xs"
        title="Редактировать"
        @click="emit('startEdit')"
      />
    </div>
  </div>
</template>
