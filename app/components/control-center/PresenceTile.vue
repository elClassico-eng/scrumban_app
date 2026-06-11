<script setup lang="ts">
type Person = {
  id: string
  name: string
  color: string
  initials: string
}

defineProps<{
  people: Person[]
  extra: number
}>()
</script>

<template>
  <div
    class="rounded-2xl p-[13px]"
    style="background: var(--island-tile); border: 1px solid var(--island-line-2);"
  >
    <div class="text-[10px] font-bold uppercase tracking-[0.1em] text-[var(--island-ink-3)] mb-[9px]">Команда</div>
    <div class="flex items-center gap-2 flex-wrap">
      <span
        v-if="people.length === 0"
        class="text-[11.5px] text-[var(--island-ink-3)]"
      >Нет участников</span>
      <template v-else>
        <span
          v-for="p in people"
          :key="p.id"
          class="flex items-center gap-[7px] rounded-full py-1 pr-[10px] pl-1"
          style="background: rgba(255,255,255,0.05);"
        >
          <span
            class="relative w-[22px] h-[22px] rounded-full flex items-center justify-center text-[9px] font-bold text-white flex-shrink-0"
            :style="{ background: p.color }"
          >
            {{ p.initials }}
          </span>
          <span class="text-[11.5px] text-[var(--island-ink-2)] max-w-[92px] truncate">{{ p.name }}</span>
        </span>
        <span v-if="extra > 0" class="text-[11.5px] text-[var(--island-ink-3)]">+{{ extra }}</span>
      </template>
    </div>
  </div>
</template>
