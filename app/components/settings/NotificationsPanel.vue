<script setup lang="ts">
const { me, update } = useProfileApi()
const toast = useToast()

const prefs = computed(() => me.data.value?.user.notificationPrefs ?? {})

function toggleNotification(type: string, enabled: boolean) {
  update.mutate(
    { notificationPrefs: { ...prefs.value, [type]: enabled } },
    {
      onError: err => toast.add({
        title: getErrorMessage(err, 'Не удалось сохранить'),
        color: 'error',
        icon: 'i-lucide-alert-circle',
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
  </section>
</template>
