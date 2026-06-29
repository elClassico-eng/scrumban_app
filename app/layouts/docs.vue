<script setup lang="ts">
type DocItem = { title: string, path: string, navTitle?: string, tab?: string, section?: string, order: number }
type TocLink = { id: string, text: string, depth: number, children?: TocLink[] }

const TAB_ORDER = ['Введение', 'Методология', 'Математика', 'Руководство', 'Проект']

const route = useRoute()
const goToApp = useAccessCta()
const colorMode = useColorMode()

const { data: pages } = await useAsyncData('docs-nav', () =>
  queryCollection('docs').order('order', 'ASC').all(),
)

const { data: current } = await useAsyncData(
  () => `docs-current:${route.path}`,
  () => queryCollection('docs').path(route.path).first(),
  { watch: [() => route.path] },
)

const { data: navigation } = await useAsyncData('docs-navigation', () =>
  queryCollectionNavigation('docs'),
)

const { data: searchFiles } = useLazyAsyncData('docs-search', () =>
  queryCollectionSearchSections('docs', { minHeading: 'h2' }), { server: false },
)

const allPages = computed(() => (pages.value ?? []) as unknown as DocItem[])

const tabs = computed(() => {
  const firstPath = new Map<string, string>()
  for (const p of allPages.value) {
    const t = p.tab ?? 'Документация'
    if (!firstPath.has(t)) firstPath.set(t, p.path)
  }
  return [...firstPath.keys()]
    .sort((a, b) => (TAB_ORDER.indexOf(a) + 1 || 99) - (TAB_ORDER.indexOf(b) + 1 || 99))
    .map(name => ({ name, path: firstPath.get(name)! }))
})

const activeTab = computed(() => current.value?.tab ?? tabs.value[0]?.name)

const groups = computed(() => {
  const items = allPages.value.filter(p => (p.tab ?? 'Документация') === activeTab.value)
  const map = new Map<string, DocItem[]>()
  for (const it of items) {
    const key = it.section ?? 'Разделы'
    if (!map.has(key)) map.set(key, [])
    map.get(key)!.push(it)
  }
  return [...map.entries()].map(([section, items]) => ({ section, items }))
})

const toc = computed<TocLink[]>(() => (current.value as { body?: { toc?: { links?: TocLink[] } } })?.body?.toc?.links ?? [])

function toggleTheme() {
  colorMode.preference = colorMode.value === 'dark' ? 'light' : 'dark'
}
</script>

<template>
  <div class="docs">
    <header class="docs__header">
      <NuxtLink to="/docs" class="docs__brand takt-logo">
        <TaktMark class="docs__mark" />
        <span class="docs__name">Такт</span>
        <span class="docs__tag">docs</span>
      </NuxtLink>

      <div class="docs__search">
        <ClientOnly>
          <UContentSearchButton :collapsed="false" class="docs__search-btn" />
          <template #fallback>
            <div class="docs__search-skeleton" />
          </template>
        </ClientOnly>
      </div>

      <div class="docs__actions">
        <ClientOnly>
          <button
            type="button"
            class="docs__icon-btn"
            :aria-label="colorMode.value === 'dark' ? 'Светлая тема' : 'Тёмная тема'"
            @click="toggleTheme"
          >
            <UIcon :name="colorMode.value === 'dark' ? 'i-lucide-sun' : 'i-lucide-moon'" class="size-[18px]" />
          </button>
        </ClientOnly>
        <button type="button" class="docs__app-btn" @click="goToApp">
          <UIcon name="i-lucide-layout-dashboard" class="docs__app-icon size-[18px]" />
          <span class="docs__app-label">Открыть приложение</span>
        </button>
      </div>
    </header>

    <nav class="docs__tabs">
      <NuxtLink
        v-for="t in tabs"
        :key="t.name"
        :to="t.path"
        class="docs__tab"
        :class="{ 'docs__tab--active': t.name === activeTab }"
      >
        {{ t.name }}
      </NuxtLink>
    </nav>

    <div class="docs__body" :class="{ 'docs__body--with-toc': toc.length }">
      <aside class="docs__sidebar">
        <nav>
          <div v-for="g in groups" :key="g.section" class="docs__group">
            <p class="docs__group-title">{{ g.section }}</p>
            <NuxtLink
              v-for="item in g.items"
              :key="item.path"
              :to="item.path"
              class="docs__link"
              exact-active-class="docs__link--active"
            >
              {{ item.navTitle ?? item.title }}
            </NuxtLink>
          </div>
        </nav>
      </aside>

      <main class="docs__main">
        <article class="docs-prose">
          <slot />
        </article>
      </main>

      <aside v-if="toc.length" class="docs__toc">
        <div class="docs__toc-inner">
          <p class="docs__toc-title">На этой странице</p>
          <nav class="docs__toc-list">
            <template v-for="link in toc" :key="link.id">
              <a class="docs__toc-link" :href="`#${link.id}`">{{ link.text }}</a>
              <a
                v-for="child in link.children"
                :key="child.id"
                class="docs__toc-link docs__toc-link--sub"
                :href="`#${child.id}`"
              >{{ child.text }}</a>
            </template>
          </nav>

          <div class="docs__toc-links">
            <button type="button" class="docs__toc-cta" @click="goToApp">
              Открыть приложение
              <UIcon name="i-lucide-arrow-up-right" class="size-4" />
            </button>
            <NuxtLink to="/" class="docs__toc-extlink" external>
              <UIcon name="i-lucide-home" class="size-[15px]" /> На сайт
            </NuxtLink>
            <a class="docs__toc-extlink" href="https://github.com/elClassico-eng/scrumban_app" target="_blank" rel="noopener">
              <UIcon name="i-lucide-github" class="size-[15px]" /> Исходный код
            </a>
          </div>
        </div>
      </aside>
    </div>

    <ClientOnly>
      <LazyUContentSearch :files="searchFiles" :navigation="navigation" />
    </ClientOnly>
  </div>
</template>

<style>
.docs {
  min-height: 100dvh;
  background: var(--island-bg);
  color: var(--island-ink);
}

/* ── Header ─────────────────────────────────────────── */
.docs__header {
  position: sticky;
  top: 0;
  z-index: 20;
  display: flex;
  align-items: center;
  gap: 24px;
  height: 60px;
  padding: 0 24px;
  border-bottom: 1px solid var(--island-line);
  background: var(--island-bg);
}
.docs__brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--island-ink);
  text-decoration: none;
  font-weight: 700;
  letter-spacing: -0.02em;
  flex: none;
}
.docs__mark { width: 22px; height: 22px; flex: none; }
.docs__tag {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  font-weight: 500;
  color: var(--island-orange);
  text-transform: uppercase;
  letter-spacing: 0.1em;
}
.docs__search { flex: 1; display: flex; justify-content: center; }
.docs__search-btn { width: 100%; max-width: 420px; }
.docs__search-skeleton {
  width: 100%;
  max-width: 420px;
  height: 34px;
  border-radius: 8px;
  background: var(--island-fill);
}
.docs__actions { display: flex; align-items: center; gap: 10px; flex: none; }
.docs__icon-btn {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: 8px;
  color: var(--island-ink-2);
  cursor: pointer;
  transition: background 0.15s, color 0.15s;
}
.docs__icon-btn:hover { background: var(--island-hover); color: var(--island-ink); }
.docs__app-btn {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  height: 34px;
  padding: 0 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: #fff;
  background: var(--island-orange);
  cursor: pointer;
  white-space: nowrap;
  transition: filter 0.15s;
}
.docs__app-btn:hover { filter: brightness(1.06); }
.docs__app-icon { display: none; }

/* ── Subheader tabs ─────────────────────────────────── */
.docs__tabs {
  position: sticky;
  top: 60px;
  z-index: 19;
  display: flex;
  gap: 4px;
  padding: 0 24px;
  border-bottom: 1px solid var(--island-line);
  background: var(--island-bg);
  overflow-x: auto;
}
.docs__tab {
  position: relative;
  padding: 12px 12px 13px;
  font-size: 14px;
  font-weight: 500;
  color: var(--island-ink-2);
  text-decoration: none;
  white-space: nowrap;
  transition: color 0.15s;
}
.docs__tab:hover { color: var(--island-ink); }
.docs__tab--active { color: var(--island-orange); }
.docs__tab--active::after {
  content: '';
  position: absolute;
  left: 8px;
  right: 8px;
  bottom: -1px;
  height: 2px;
  background: var(--island-orange);
  border-radius: 2px;
}

/* ── Body grid ──────────────────────────────────────── */
.docs__body {
  display: grid;
  grid-template-columns: 272px minmax(0, 1fr);
}
.docs__body--with-toc {
  grid-template-columns: 272px minmax(0, 1fr) 232px;
}

.docs__sidebar {
  position: sticky;
  top: 109px;
  align-self: start;
  height: calc(100dvh - 109px);
  overflow-y: auto;
  padding: 28px 20px 28px 24px;
  border-right: 1px solid var(--island-line);
}
.docs__group { margin-bottom: 22px; }
.docs__group-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--island-ink-3);
  margin: 0 0 8px;
  font-weight: 600;
}
.docs__link {
  display: block;
  padding: 6px 10px;
  border-radius: 8px;
  font-size: 14px;
  color: var(--island-ink-2);
  text-decoration: none;
  transition: background 0.15s, color 0.15s;
}
.docs__link:hover { background: var(--island-hover); color: var(--island-ink); }
.docs__link--active {
  background: var(--island-orange-tint);
  color: var(--island-orange);
}

.docs__main { padding: 44px 56px 96px; min-width: 0; }
.docs-prose { max-width: 760px; line-height: 1.7; font-size: 16px; }
.docs-prose h1 { font-size: 34px; font-weight: 700; letter-spacing: -0.02em; margin: 0 0 20px; color: var(--island-ink); }
.docs-prose h2 { font-size: 24px; font-weight: 700; letter-spacing: -0.01em; margin: 40px 0 14px; color: var(--island-orange); scroll-margin-top: 128px; }
.docs-prose h3 { font-size: 18px; font-weight: 600; margin: 28px 0 10px; color: var(--island-ink); scroll-margin-top: 128px; }
.docs-prose :is(h1, h2, h3) a { color: inherit; text-decoration: none; }
.docs-prose p { margin: 0 0 16px; color: var(--island-ink-2); }
.docs-prose a { color: var(--island-orange); text-underline-offset: 3px; }
.docs-prose ul, .docs-prose ol { margin: 0 0 16px; padding-left: 22px; color: var(--island-ink-2); }
.docs-prose li { margin: 6px 0; }
.docs-prose strong { color: var(--island-ink); }
.docs-prose code {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.88em;
  background: var(--island-fill);
  padding: 2px 6px;
  border-radius: 5px;
}
.docs-prose pre {
  background: var(--island-bg-2);
  border: 1px solid var(--island-line);
  border-radius: 12px;
  padding: 16px 18px;
  overflow-x: auto;
  margin: 0 0 18px;
}
.docs-prose pre code { background: none; padding: 0; }
.docs-prose blockquote {
  border-left: 3px solid var(--island-orange);
  margin: 0 0 18px;
  padding: 4px 0 4px 16px;
  color: var(--island-ink-2);
}
.docs-prose hr { border: none; border-top: 1px solid var(--island-line); margin: 32px 0; }

/* ── Right TOC ──────────────────────────────────────── */
.docs__toc {
  position: sticky;
  top: 109px;
  align-self: start;
  height: calc(100dvh - 109px);
  overflow-y: auto;
  padding: 44px 24px 28px 8px;
}
.docs__toc-title {
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.12em;
  color: var(--island-ink-3);
  margin: 0 0 12px;
  font-weight: 600;
}
.docs__toc-list { display: flex; flex-direction: column; }
.docs__toc-link {
  display: block;
  padding: 4px 0;
  font-size: 13px;
  line-height: 1.45;
  color: var(--island-ink-2);
  text-decoration: none;
  border-left: 2px solid transparent;
  padding-left: 12px;
  margin-left: -12px;
  transition: color 0.15s, border-color 0.15s;
}
.docs__toc-link:hover { color: var(--island-orange); }
.docs__toc-link--sub { padding-left: 24px; font-size: 12.5px; color: var(--island-ink-3); }
.docs__toc-links {
  margin-top: 24px;
  padding-top: 20px;
  border-top: 1px solid var(--island-line);
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.docs__toc-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  align-self: start;
  padding: 7px 12px;
  margin-bottom: 6px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  color: var(--island-orange);
  background: var(--island-orange-tint);
  cursor: pointer;
  transition: background 0.15s;
}
.docs__toc-cta:hover { background: var(--island-orange-soft); }
.docs__toc-extlink {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 5px 0;
  font-size: 13px;
  color: var(--island-ink-2);
  text-decoration: none;
  transition: color 0.15s;
}
.docs__toc-extlink:hover { color: var(--island-ink); }

@media (max-width: 1100px) {
  .docs__body--with-toc { grid-template-columns: 272px minmax(0, 1fr); }
  .docs__toc { display: none; }
}
@media (max-width: 860px) {
  .docs__header { gap: 12px; padding: 0 14px; }
  .docs__search { display: none; }
  .docs__actions { margin-left: auto; }
  .docs__app-label { display: none; }
  .docs__app-icon { display: block; }
  .docs__app-btn { padding: 0; width: 34px; justify-content: center; }
  .docs__body, .docs__body--with-toc { grid-template-columns: 1fr; }
  .docs__sidebar {
    position: static;
    height: auto;
    border-right: none;
    border-bottom: 1px solid var(--island-line);
  }
  .docs__main { padding: 28px 22px 72px; }
}
</style>
