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
  return `с ${d.getDate()} ${MONTHS[d.getMonth()]}`
})

const roleOptions = computed(() => roleOptionsBelow(props.myRole))
</script>

<template>
  <div
    class="relative surface-soft rounded-2xl p-4 pt-5 flex flex-col"
    :class="isYou ? 'ring-1 ring-accent-500' : ''"
  >
    <span
      class="absolute left-4 right-4 top-0 h-[3px] rounded-b-sm"
      :class="isYou ? 'bg-accent-500' : ROLE_STRIPE_CLASS[member.role]"
    />

    <div class="flex items-start gap-3 mb-3">
      <UserAvatar :user="member" size="lg" />
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-1.5">
          <p class="font-semibold text-[15px] text-default truncate">{{ displayName(member) }}</p>
          <span
            v-if="isYou"
            class="text-[9px] font-bold tracking-wider px-1.5 py-px rounded bg-primary text-accent-500 uppercase"
          >Вы</span>
        </div>
        <p
          v-if="member.jobTitle"
          class="text-[12.5px] text-muted truncate flex items-center gap-1.5 mt-1"
        >
          <UIcon name="i-hugeicons-briefcase-01" class="size-3 shrink-0 text-dimmed" />
          {{ member.jobTitle }}
        </p>
        <p class="text-[12px] text-muted truncate flex items-center gap-1.5 mt-0.5 font-mono" :title="member.email">
          <UIcon name="i-hugeicons-mail-01" class="size-3 shrink-0 text-dimmed" />
          {{ member.email }}
        </p>
      </div>
      <UButton
        v-if="canEdit && !isEditing"
        icon="i-hugeicons-pencil"
        color="neutral"
        variant="ghost"
        size="xs"
        title="Редактировать"
        @click="emit('startEdit')"
      />
      <UButton
        v-else-if="isEditing"
        icon="i-hugeicons-x"
        color="neutral"
        variant="ghost"
        size="xs"
        title="Готово"
        @click="emit('stopEdit')"
      />
    </div>

    <div class="flex items-center gap-2.5 pt-3 border-t border-default mt-auto">
      <template v-if="isEditing && canEdit">
        <USelect
          :model-value="member.role"
          :items="roleOptions"
          size="xs"
          class="flex-1"
          @update:model-value="(v: Role) => emit('changeRole', v)"
        />
        <UButton
          icon="i-hugeicons-delete-02"
          color="error"
          variant="ghost"
          size="xs"
          :loading="removeLoading"
          title="Удалить из workspace"
          @click="emit('remove')"
        />
      </template>
      <template v-else>
        <WorkspaceMembersRoleChip :role="member.role" :editable="canEdit" />
        <span class="ml-auto text-[11.5px] text-dimmed flex items-center gap-1 tabular-nums">
          <UIcon name="i-hugeicons-calendar-03" class="size-3" />
          {{ since }}
        </span>
      </template>
    </div>
  </div>
</template>
