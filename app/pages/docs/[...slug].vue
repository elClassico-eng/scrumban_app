<script setup lang="ts">
definePageMeta({ layout: 'docs' })

const route = useRoute()

const { data: page } = await useAsyncData(`docs:${route.path}`, () =>
  queryCollection('docs').path(route.path).first(),
)

if (!page.value) {
  throw createError({ statusCode: 404, statusMessage: 'Страница документации не найдена', fatal: true })
}

useSeoMeta({
  title: () => (page.value?.title ? `${page.value.title} — Такт` : 'Документация — Такт'),
  description: () => page.value?.description,
})
</script>

<template>
  <ContentRenderer v-if="page" :value="page" />
</template>
