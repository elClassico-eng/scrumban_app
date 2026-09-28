<script setup lang="ts">
import { pageRoutes } from '~/routing'

definePageMeta({
  middleware: (to) => {
    useWorkspaceStore().setCurrent(to.params.id as string)
    return navigateTo(pageRoutes.settings('team'), { replace: true })
  },
})
</script>

<template>
  <div />
</template>
