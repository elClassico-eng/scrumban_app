<script setup lang="ts">
import { pageRoutes } from '~/routing'

const props = withDefaults(defineProps<{
  visibleLimit?: number
}>(), {
  visibleLimit: 4,
})

const workspaceStore = useWorkspaceStore()
const authStore = useAuthStore()
const { list } = useWorkspacesApi()

const workspaces = computed(() => list.data.value?.workspaces ?? [])
const current = computed(() => {
  const id = workspaceStore.currentId
  return workspaces.value.find(w => w.id === id) ?? workspaces.value[0] ?? null
})

const currentWsId = computed(() => current.value?.id ?? '')
const { list: membersList } = useMembersApi(currentWsId)
const members = computed(() => membersList.data.value?.members ?? [])

const sortedMembers = computed(() => {
  const myId = authStore.user?.id
  if (!myId) return members.value
  const me = members.value.find(m => m.userId === myId)
  const rest = members.value.filter(m => m.userId !== myId)
  return me ? [me, ...rest] : rest
})

const visibleMembers = computed(() => sortedMembers.value.slice(0, props.visibleLimit))
const hiddenCount = computed(() =>
  Math.max(0, sortedMembers.value.length - props.visibleLimit),
)
</script>

<template>
  <NuxtLink
    v-if="current && members.length > 0"
    :to="pageRoutes.workspaceMembers(current.id)"
    class="flex items-center -space-x-2 hover:opacity-90 transition-opacity"
  >
    <UTooltip
      v-for="member in visibleMembers"
      :key="member.userId"
      :text="displayName(member)"
    >
      <div
        class="size-8 rounded-full bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center shrink-0 overflow-hidden border-2 border-white dark:border-zinc-800"
      >
        <img
          v-if="member.avatarUrl"
          :src="member.avatarUrl"
          alt=""
          class="size-full object-cover"
        >
        <span v-else>{{ initials(member) }}</span>
      </div>
    </UTooltip>
    <div
      v-if="hiddenCount > 0"
      class="size-8 rounded-full bg-elevated text-muted text-xs font-medium flex items-center justify-center shrink-0 border-2 border-white dark:border-zinc-800"
      :title="`Ещё ${hiddenCount}`"
    >
      +{{ hiddenCount }}
    </div>
  </NuxtLink>
</template>