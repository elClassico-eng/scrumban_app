<script setup lang="ts">
type Notif = {
  id: string
  icon: string
  color: string
  title: string
  why: string
  cta: string
  hasTarget: boolean
  t: string
  unread: boolean
}

defineProps<{
  notifs: Notif[]
}>()

defineEmits<{
  read: [e: Event, id: string]
}>()
</script>

<template>
  <div
    class="rounded-2xl p-[13px] min-h-0 overflow-auto h-full"
    style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
  >
    <div class="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--island-ink-3)] mb-[9px]">Уведомления</div>
    <div
      v-if="notifs.length === 0"
      class="text-[11.5px] text-[var(--island-ink-3)]"
    >Нет уведомлений</div>
    <div v-else class="flex flex-col gap-3">
      <div
        v-for="n in notifs"
        :key="n.id"
        class="flex gap-[10px] items-start p-2.5 rounded-[10px] cursor-pointer hover:bg-[var(--island-hover)]"
        @click.stop="(e) => $emit('read', e, n.id)"
      >
        <span
          class="w-[30px] h-[30px] rounded-lg grid place-items-center flex-shrink-0 text-white"
          :style="{ background: n.color }"
        >
          <UIcon :name="n.icon" class="w-[14px] h-[14px]" />
        </span>
        <div class="text-[12.5px] leading-[1.4] text-[var(--island-ink-2)] min-w-0 flex-1">
          <b class="block text-[var(--island-ink)] font-semibold">{{ n.title }}</b>
          <span v-if="n.why" class="block">{{ n.why }}</span>
          <div class="flex items-center gap-2 mt-[3px] text-[11px] text-[var(--island-ink-3)]">
            <span>{{ n.t }}</span>
            <span v-if="n.hasTarget" class="font-semibold text-[var(--island-orange-2)]">{{ n.cta }} →</span>
          </div>
        </div>
        <span
          v-if="n.unread"
          class="w-[7px] h-[7px] rounded-full bg-[var(--island-orange)] mt-[11px] flex-shrink-0"
        />
      </div>
    </div>
  </div>
</template>
