<script setup lang="ts">
import { useQueryClient } from '@tanstack/vue-query'
import { z } from 'zod'
import { apiRoutes } from '~/routing'

const BIO_MAX = 280

const { me, update } = useProfileApi()
const { current: workspace } = useCurrentWorkspace()
const toast = useToast()
const qc = useQueryClient()

const user = computed(() => me.data.value?.user ?? null)
const avatarUrl = computed(() => user.value?.avatarUrl ?? null)
const removeAvatar = () => $fetch(apiRoutes.avatar, { method: 'DELETE' })
const isVerified = computed(() => !!user.value?.emailVerifiedAt)

const resending = ref(false)
const resendSent = ref(false)

async function resendVerification() {
  resending.value = true
  try {
    await $fetch(apiRoutes.authResendVerification, { method: 'POST' })
    resendSent.value = true
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось отправить письмо'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }
  finally {
    resending.value = false
  }
}

const schema = z.object({
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  jobTitle: z.string().trim().max(150),
  bio: z.string().max(BIO_MAX),
})
type State = z.infer<typeof schema>

const state = reactive<State>({ firstName: '', lastName: '', jobTitle: '', bio: '' })

function fromUser(): State {
  const u = user.value
  return { firstName: u?.firstName ?? '', lastName: u?.lastName ?? '', jobTitle: u?.jobTitle ?? '', bio: u?.bio ?? '' }
}

const editing = ref(false)

function reset() {
  Object.assign(state, fromUser())
}

function cancel() {
  reset()
  editing.value = false
}

watch(user, reset, { immediate: true })

const dirty = computed(() => JSON.stringify(state) !== JSON.stringify(fromUser()))

async function save() {
  try {
    await update.mutateAsync(Object.fromEntries(
      Object.entries(state).map(([k, v]) => [k, v.trim() || null]),
    ))
    editing.value = false
    toast.add({ title: 'Профиль сохранён', color: 'success', icon: 'i-hugeicons-checkmark-circle-02', duration: 1500 })
  }
  catch (err) {
    toast.add({ title: getErrorMessage(err, 'Не удалось сохранить'), color: 'error', icon: 'i-hugeicons-alert-circle' })
  }
}

const preview = computed(() => ({
  userId: user.value?.id ?? '',
  email: user.value?.email ?? '',
  firstName: state.firstName.trim() || null,
  lastName: state.lastName.trim() || null,
  middleName: null,
  avatarUrl: avatarUrl.value,
  jobTitle: state.jobTitle.trim() || null,
  bio: state.bio.trim() || null,
  role: workspace.value?.role ?? 'member',
  createdAt: user.value?.createdAt ?? new Date(),
}))

const avatarFallback = computed(() => initials({ firstName: state.firstName, lastName: state.lastName, email: user.value?.email ?? '' }))
</script>

<template>
  <div v-if="me.isLoading.value" class="py-12 text-center text-muted">
    <UIcon name="i-hugeicons-loading-03" class="size-6 animate-spin" />
  </div>

  <div v-else-if="user" class="grid gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
    <SettingsTile title="О вас">
      <template v-if="!editing" #actions>
        <SettingsEditButton @click="editing = true" />
      </template>

      <div v-if="!editing" class="space-y-5">
        <div class="flex items-center gap-4">
          <UserAvatar :user="preview" size="xl" />
          <div class="min-w-0">
            <p class="truncate text-lg font-semibold text-default">{{ displayName(preview) }}</p>
            <p class="truncate text-sm text-muted">{{ preview.jobTitle || 'Должность не указана' }}</p>
          </div>
        </div>
        <dl>
          <SettingsReadField label="О себе" :value="user.bio" empty="Пара слов о себе поможет коллегам" />
        </dl>
      </div>

      <UForm v-else :schema="schema" :state="state" class="space-y-4" @submit="save">
        <FilesImageUploader
          :target="{ kind: 'user_avatar' }"
          :current-url="avatarUrl"
          :fallback="avatarFallback"
          shape="circle"
          :remove="removeAvatar"
          @changed="qc.invalidateQueries()"
        />

        <div class="grid gap-3 sm:grid-cols-2">
          <UFormField label="Имя" name="firstName">
            <UInput v-model="state.firstName" class="w-full" />
          </UFormField>
          <UFormField label="Фамилия" name="lastName">
            <UInput v-model="state.lastName" class="w-full" />
          </UFormField>
        </div>

        <UFormField label="Должность" name="jobTitle" hint="видна коллегам">
          <UInput v-model="state.jobTitle" class="w-full" placeholder="Например, Frontend-разработчик" />
        </UFormField>

        <UFormField label="О себе" name="bio" :hint="`${state.bio.length} / ${BIO_MAX}`">
          <UTextarea v-model="state.bio" :rows="3" :maxlength="BIO_MAX" autoresize class="w-full" placeholder="Чем вы занимаетесь и как с вами лучше связаться" />
        </UFormField>

        <div class="flex justify-end gap-2">
          <UButton variant="ghost" color="neutral" @click="cancel">Отмена</UButton>
          <UButton type="submit" :disabled="!dirty" :loading="update.isPending.value">Сохранить</UButton>
        </div>
      </UForm>

      <div class="mt-5 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-xl bg-zinc-50 px-3 py-2 text-sm dark:bg-elevated/60">
        <UIcon
          :name="isVerified ? 'i-hugeicons-checkmark-circle-02' : 'i-hugeicons-alert-circle'"
          class="size-4 shrink-0"
          :class="isVerified ? 'text-success' : 'text-warning'"
        />
        <span class="min-w-0 truncate text-default">{{ user.email }}</span>
        <span v-if="!isVerified" class="text-muted">· не подтверждена</span>
        <UButton
          v-if="!isVerified"
          size="xs"
          variant="link"
          color="neutral"
          :loading="resending"
          :disabled="resendSent"
          @click="resendVerification"
        >
          {{ resendSent ? 'Письмо отправлено' : 'Отправить письмо' }}
        </UButton>
      </div>
    </SettingsTile>

    <div class="space-y-3">
      <p class="px-1 text-sm text-muted">Так вас видят коллеги</p>
      <WorkspaceMembersMemberCard
        :member="preview"
        is-you
        :can-edit="false"
        :is-editing="false"
        :my-role="preview.role"
        :remove-loading="false"
        class="pointer-events-none"
      />
      <div class="pointer-events-none rounded-xl p-3 surface-soft">
        <span class="rounded-md bg-accent-500/15 px-1.5 py-0.5 font-mono text-[11px] text-accent-600">TKT-42</span>
        <p class="mt-2 text-sm text-default">Разобрать входящие баги</p>
        <div class="mt-2 flex justify-end">
          <UserAvatar :user="preview" size="xs" />
        </div>
      </div>
    </div>
  </div>
</template>
