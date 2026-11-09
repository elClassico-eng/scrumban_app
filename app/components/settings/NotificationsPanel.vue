<script setup lang="ts">
import { DEFAULT_EMAIL_PREFS, INSTANT_NOTIFICATION_TYPES, type InstantNotificationType } from '#shared/types/notification'
import type { UpdateUserProfileInput } from '#shared/types/auth'

const { me, update } = useProfileApi()
const toast = useToast()

const prefs = computed(() => me.data.value?.user.notificationPrefs ?? {})
const emailPrefs = computed(() => me.data.value?.user.emailPrefs ?? DEFAULT_EMAIL_PREFS)

function toggleNotification(type: string, enabled: boolean) {
  save({ notificationPrefs: { ...prefs.value, [type]: enabled } })
}

function toggleDigest(enabled: boolean) {
  save({ emailPrefs: { ...emailPrefs.value, digest: enabled } })
}

function toggleInstant(type: InstantNotificationType, enabled: boolean) {
  const instant = emailPrefs.value.instant.filter(t => t !== type)
  save({ emailPrefs: { ...emailPrefs.value, instant: enabled ? [...instant, type] : instant } })
}

function save(patch: UpdateUserProfileInput) {
  update.mutate(
    patch,
    {
      onError: err => toast.add({
        title: getErrorMessage(err, 'Не удалось сохранить'),
        color: 'error',
        icon: 'i-hugeicons-alert-circle',
      }),
    },
  )
}
</script>

<template>
  <section class="surface-soft rounded-2xl p-5">
    <h2 class="mb-1 font-semibold text-default">Уведомления</h2>
    <p class="mb-4 text-xs text-muted">Какие события присылать в колокольчик</p>
    <div class="divide-y divide-default">
      <div
        v-for="(label, type) in NOTIFICATION_TYPE_LABEL"
        :key="type"
        class="flex items-center justify-between gap-4 py-2.5"
      >
        <span class="text-sm text-default">{{ label }}</span>
        <USwitch
          :model-value="prefs[type] !== false"
          @update:model-value="toggleNotification(type, $event)"
        />
      </div>
    </div>

    <h2 class="mt-6 mb-1 font-semibold text-default">Письма на почту</h2>
    <p class="mb-4 text-xs text-muted">Приходят на {{ me.data.value?.user.email }}, только если email подтверждён</p>
    <div class="divide-y divide-default">
      <div class="flex items-center justify-between gap-4 py-2.5">
        <div>
          <p class="text-sm text-default">Утренний дайджест</p>
          <p class="text-xs text-muted">В 9:00 по Москве: просроченное, сроки на сегодня, блокеры и непрочитанное. Без новостей письма не будет</p>
        </div>
        <USwitch :model-value="emailPrefs.digest" @update:model-value="toggleDigest" />
      </div>
      <p class="pt-4 pb-1 text-xs font-medium text-muted">Сразу письмом, не дожидаясь дайджеста</p>
      <div
        v-for="type in INSTANT_NOTIFICATION_TYPES"
        :key="type"
        class="flex items-center justify-between gap-4 py-2.5"
      >
        <span class="text-sm text-default">{{ INSTANT_NOTIFICATION_LABEL[type] }}</span>
        <USwitch
          :model-value="emailPrefs.instant.includes(type)"
          @update:model-value="toggleInstant(type, $event)"
        />
      </div>
    </div>
  </section>
</template>
