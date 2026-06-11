<script setup lang="ts">
import type { BoardColumn as Column } from '#shared/types/column'
import type { MemberView } from '#shared/types/workspace'
defineProps<{
  selected: Set<string>
  columns: Column[]
  members: MemberView[]
  workspaceId: string
  boardId: string
}>()
defineEmits<{ clear: [] }>()
</script>

<template>
  <div class="sticky bottom-4 mx-auto w-max flex items-center gap-3.5 bg-inverted text-inverted rounded-full py-2 pr-2.5 pl-[18px] shadow-xl z-[5]">
    <span class="text-[13px] font-semibold"><b class="text-accent-500">{{ selected.size }}</b> выбрано</span>
    <button class="size-[30px] grid place-items-center rounded-full text-inverted/70 hover:bg-white/10" @click="$emit('clear')">
      <UIcon name="i-lucide-x" class="size-4" />
    </button>
  </div>
</template>
