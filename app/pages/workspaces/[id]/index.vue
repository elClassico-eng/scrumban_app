<script setup lang="ts">
import { pageRoutes } from '~/routing'

const route = useRoute()
const workspaceStore = useWorkspaceStore()
const id = route.params.id as string

workspaceStore.setCurrent(id)
await navigateTo(pageRoutes.boards(id), { replace: true })
</script>

<template>
  <div />
</template>