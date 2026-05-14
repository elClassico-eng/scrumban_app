<script setup lang="ts">
import type { MemberView } from '#shared/types/workspace'

const props = defineProps<{
  members: MemberView[]
}>()

const open = defineModel<boolean>('open', { default: false })

const emit = defineEmits<{
  select: [member: MemberView]
}>()

const groups = computed(() => [
  {
    id: 'members',
    label: 'Участники',
    items: props.members.map(m => ({
      id: m.userId,
      label: displayName(m),
      suffix: m.email,
      onSelect: () => onPick(m),
    })),
  },
])

function onPick(member: MemberView) {
  emit('select', member)
  open.value = false
}
</script>

<template>
  <UModal
    v-model:open="open"
    :overlay="true"
    title="Упомянуть участника"
    :ui="{
      content: 'max-w-xl p-0 z-[70]',
      overlay: 'bg-black/70 z-[70]',
    }"
  >
    <template #content>
      <UCommandPalette
        :groups="groups"
        placeholder="Поиск по имени или email..."
        :close="{ onClick: () => { open = false } }"
      />
    </template>
  </UModal>
</template>