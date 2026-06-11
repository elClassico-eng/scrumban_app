<script setup lang="ts">
type Notif = {
  id: number
  iconType: 'at' | 'move' | 'check'
  color: string
  who: string
  txt: string
  t: string
  unread: boolean
}

defineProps<{
  notifs: Notif[]
}>()

defineEmits<{
  read: [e: Event, id: number]
}>()

const ICON_MAP: Record<string, string> = {
  move: 'i-lucide-move',
  at: 'i-lucide-at-sign',
  build: 'i-lucide-hammer',
  check: 'i-lucide-check',
}

function resolveIcon(iconType: string): string {
  return ICON_MAP[iconType] ?? 'i-lucide-circle'
}
</script>

<template>
  <div
    class="rounded-2xl p-[13px] flex-1 min-h-0 overflow-auto"
    style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
  >
    <div class="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--island-ink-3)] mb-[9px]">Уведомления</div>
    <div class="flex flex-col gap-0.5">
      <div
        v-for="n in notifs"
        :key="n.id"
        class="flex gap-[10px] items-start p-2 rounded-[10px] cursor-pointer hover:bg-[rgba(255,255,255,0.05)]"
        @click="(e) => $emit('read', e, n.id)"
      >
        <span
          class="w-[26px] h-[26px] rounded-lg grid place-items-center flex-shrink-0 text-white"
          :style="{ background: n.color }"
        >
          <UIcon :name="resolveIcon(n.iconType)" class="w-[14px] h-[14px]" />
        </span>
        <div class="text-[12px] leading-[1.4] text-[var(--island-ink-2)] min-w-0">
          <b class="text-[var(--island-ink)] font-semibold">{{ n.who }}</b> {{ n.txt }}
          <div class="text-[10.5px] text-[var(--island-ink-3)] mt-[1px]">{{ n.t }} назад</div>
        </div>
        <span
          v-if="n.unread"
          class="w-[7px] h-[7px] rounded-full bg-[var(--island-orange)] mt-[9px] flex-shrink-0"
        />
      </div>
    </div>
  </div>
</template>
