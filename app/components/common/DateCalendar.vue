<script setup lang="ts">
import type { CalendarDate} from '@internationalized/date';
import { parseDate } from '@internationalized/date'

const model = defineModel<string>({ default: '' })

const calValue = computed<CalendarDate | null>({
  get: () => {
    if (!model.value) return null
    try {
      return parseDate(model.value)
    }
    catch {
      return null
    }
  },
  set: (v) => {
    model.value = v ? v.toString() : ''
  },
})
</script>

<template>
  <UCalendar v-model="calValue" />
</template>
