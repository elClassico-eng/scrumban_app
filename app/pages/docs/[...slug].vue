<script setup lang="ts">
import RoadmapBoard from '~/components/content/RoadmapBoard.vue'
import { docsContentPath } from '~/utils/docs-path'

definePageMeta({ layout: 'docs' })

const contentComponents = { 'roadmap-board': RoadmapBoard, RoadmapBoard }

const route = useRoute()
const contentPath = docsContentPath(route.path)

const { data: page } = await useAsyncData(`docs:${contentPath}`, () =>
  queryCollection('docs').path(contentPath).first(),
)

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Страница документации не найдена', fatal: true })
}

useSeoMeta({
  title: () => (page.value?.title ? `${page.value.title} – Такт` : 'Документация – Такт'),
  description: () => page.value?.description,
})
</script>

<template>
  <ContentRenderer v-if="page" :value="page" :components="contentComponents" />
</template>
