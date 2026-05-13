<script setup lang="ts">
import { z } from 'zod'

useHead({ title: 'Личный кабинет — Scrumban' })

const { me, update } = useProfileApi()
const toast = useToast()

const schema = z.object({
  firstName: z.string().trim().max(100),
  lastName: z.string().trim().max(100),
  middleName: z.string().trim().max(100),
  jobTitle: z.string().trim().max(150),
  bio: z.string().max(5000),
  avatarUrl: z.union([z.url().max(2000), z.literal('')]),
})

type State = z.infer<typeof schema>
const state = reactive<State>({
  firstName: '',
  lastName: '',
  middleName: '',
  jobTitle: '',
  bio: '',
  avatarUrl: '',
})

watch(
  () => me.data.value?.user,
  (u) => {
    if (!u) return
    state.firstName = u.firstName ?? ''
    state.lastName = u.lastName ?? ''
    state.middleName = u.middleName ?? ''
    state.jobTitle = u.jobTitle ?? ''
    state.bio = u.bio ?? ''
    state.avatarUrl = u.avatarUrl ?? ''
  },
  { immediate: true },
)

async function onSubmit() {
  try {
    await update.mutateAsync({
      firstName: state.firstName.trim() || null,
      lastName: state.lastName.trim() || null,
      middleName: state.middleName.trim() || null,
      jobTitle: state.jobTitle.trim() || null,
      bio: state.bio.trim() || null,
      avatarUrl: state.avatarUrl.trim() || null,
    })
    toast.add({
      title: 'Профиль обновлён',
      color: 'success',
      icon: 'i-lucide-check',
      duration: 1500,
    })
  }
  catch (err) {
    toast.add({
      title: getErrorMessage(err, 'Не удалось сохранить'),
      color: 'error',
      icon: 'i-lucide-alert-circle',
    })
  }
}

const previewName = computed(() => displayName({
  firstName: state.firstName,
  lastName: state.lastName,
  email: me.data.value?.user.email ?? '',
}))
const previewInitials = computed(() => initials({
  firstName: state.firstName,
  lastName: state.lastName,
  email: me.data.value?.user.email ?? '',
}))
</script>

<template>
  <div class="max-w-3xl mx-auto py-8 space-y-8">
    <div class="space-y-1">
      <h1 class="text-2xl font-bold tracking-tight">Личный кабинет</h1>
      <p class="text-sm text-muted">
        Эта информация видна другим участникам ваших workspace'ов.
      </p>
    </div>

    <div v-if="me.isLoading.value" class="text-center py-12 text-muted">
      <UIcon name="i-lucide-loader" class="animate-spin size-6" />
    </div>

    <UForm
      v-else-if="me.data.value"
      :schema="schema"
      :state="state"
      class="space-y-6"
      @submit="onSubmit"
    >
      <UCard>
        <div class="flex items-start gap-6">
          <div class="size-20 rounded-full bg-primary/10 text-primary text-2xl font-semibold flex items-center justify-center shrink-0 overflow-hidden">
            <img
              v-if="state.avatarUrl"
              :src="state.avatarUrl"
              alt=""
              class="size-full object-cover"
            >
            <span v-else>{{ previewInitials }}</span>
          </div>
          <div class="flex-1 min-w-0 space-y-1">
            <p class="text-xl font-semibold truncate">{{ previewName }}</p>
            <p class="text-sm text-muted truncate">{{ me.data.value.user.email }}</p>
            <p v-if="state.jobTitle" class="text-sm text-muted truncate">{{ state.jobTitle }}</p>
          </div>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">Имя</h2>
        </template>
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
          <UFormField label="Фамилия" name="lastName">
            <UInput v-model="state.lastName" class="w-full" />
          </UFormField>
          <UFormField label="Имя" name="firstName">
            <UInput v-model="state.firstName" class="w-full" />
          </UFormField>
          <UFormField label="Отчество" name="middleName">
            <UInput v-model="state.middleName" class="w-full" />
          </UFormField>
        </div>
      </UCard>

      <UCard>
        <template #header>
          <h2 class="font-semibold">О себе</h2>
        </template>
        <div class="space-y-4">
          <UFormField label="Должность" name="jobTitle">
            <UInput
              v-model="state.jobTitle"
              class="w-full"
              placeholder="Например: Senior Frontend Developer"
            />
          </UFormField>
          <UFormField
            label="Аватар (URL)"
            name="avatarUrl"
            description="Ссылка на изображение — Gravatar, Telegram-аватарка или любой публичный URL"
          >
            <UInput
              v-model="state.avatarUrl"
              class="w-full"
              placeholder="https://..."
            />
          </UFormField>
          <UFormField label="Краткое описание" name="bio">
            <UTextarea
              v-model="state.bio"
              :rows="4"
              class="w-full"
              placeholder="Чем занимаетесь, на чём специализируетесь"
            />
          </UFormField>
        </div>
      </UCard>

      <div class="flex justify-end">
        <UButton type="submit" :loading="update.isPending.value">
          Сохранить
        </UButton>
      </div>
    </UForm>
  </div>
</template>