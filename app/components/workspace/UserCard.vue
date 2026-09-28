<script setup lang="ts">
import type { SessionUser } from '#shared/types/auth'
import type { Role } from '#shared/types/domain'
import type { Task } from '#shared/types/task'
import { pageRoutes } from '~/routing'

const props = defineProps<{
  user: SessionUser | null
  role: Role | null
  tasks: Task[]
}>()

const { open, overdue } = useMyTasks(() => props.tasks, () => props.user?.id ?? null)

const name = computed(() => (props.user ? displayName(props.user) : ''))
const subtitle = computed(() =>
  props.user?.jobTitle?.trim() || (props.role ? ROLE_LABEL[props.role] : ''),
)
</script>

<template>
  <section v-if="user" class="flex h-full min-w-0 flex-col rounded-3xl bg-[#161513] p-2.5 text-white">
    <div class="relative h-44 shrink-0 overflow-hidden rounded-2xl sm:h-56 lg:h-auto lg:min-h-[200px] lg:flex-1">
      <img
        v-if="user.avatarUrl"
        :src="user.avatarUrl"
        :alt="name"
        class="size-full object-cover object-[50%_32%]"
      >
      <div
        v-else
        class="grid size-full place-items-center text-5xl font-semibold"
        :style="{ background: avatarColor(user.id) }"
      >
        {{ initials(user) }}
      </div>
    </div>

    <div class="px-2 pb-1 pt-4">
      <p class="flex items-center gap-1.5">
        <span class="truncate text-lg font-semibold tracking-tight">{{ name }}</span>
        <UIcon
          v-if="user.emailVerifiedAt"
          name="i-lucide-badge-check"
          class="size-[18px] shrink-0 text-success-500"
          title="Почта подтверждена"
        />
      </p>
      <p v-if="subtitle" class="mt-1 truncate text-sm text-white/55">{{ subtitle }}</p>

      <div class="mt-4 flex items-center gap-3.5">
        <span class="flex items-center gap-1.5" title="Открытых задач на вас">
          <UIcon name="i-lucide-circle-dot" class="size-4 text-white/45" />
          <span class="text-[15px] font-semibold tabular-nums">{{ open.length }}</span>
        </span>
        <span class="flex items-center gap-1.5" title="Просрочено">
          <UIcon name="i-lucide-calendar-x" class="size-4 text-white/45" />
          <span
            class="text-[15px] font-semibold tabular-nums"
            :class="overdue ? 'text-error-400' : ''"
          >{{ overdue }}</span>
        </span>

        <NuxtLink
          :to="pageRoutes.me"
          class="ml-auto inline-flex items-center gap-1 rounded-full bg-white/10 px-3.5 py-1.5 text-[13px] font-medium transition-colors hover:bg-white/20"
        >
          Профиль
          <UIcon name="i-lucide-arrow-up-right" class="size-3.5" />
        </NuxtLink>
      </div>
    </div>
  </section>
</template>
