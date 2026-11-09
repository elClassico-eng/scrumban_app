<script setup lang="ts">
import { pageRoutes } from '~/routing'

definePageMeta({
  middleware: (to) => {
    return navigateTo(pageRoutes.workspaceSettings(to.params.id as string), { replace: true })
  },
})
</script>

<template>
  <div />
</template>
