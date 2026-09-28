<script setup lang="ts">
import { pageRoutes } from '~/routing'

definePageMeta({
  middleware: () => navigateTo(pageRoutes.settings(), { replace: true }),
})
</script>

<template>
  <div />
</template>
