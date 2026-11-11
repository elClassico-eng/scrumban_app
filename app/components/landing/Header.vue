<script setup lang="ts">
import { pageRoutes } from '~/routing'
import { LANDING_NAV } from '~/utils/landing-content'

const { start, startLabel, authenticated } = useAccessCta()
const open = ref(false)

// Over a [data-header-dark] section the header switches to light text.
// ponytail: zone is computed from the viewport height at mount; recompute on resize if it matters.
const HEADER_ZONE = 110
const overDark = ref(false)
let io: IntersectionObserver | null = null
onMounted(() => {
  const dark = document.querySelectorAll('[data-header-dark]')
  if (!dark.length) return
  io = new IntersectionObserver(
    entries => entries.forEach(e => (overDark.value = e.isIntersecting)),
    { rootMargin: `0px 0px ${HEADER_ZONE - window.innerHeight}px 0px` },
  )
  dark.forEach(el => io!.observe(el))
})
onBeforeUnmount(() => io?.disconnect())
</script>

<template>
  <header class="lhdr" :class="{ 'lhdr--dark': overDark && !open }">
    <LandingAnnounceBar />
    <div class="lhdr__in">
      <a class="lhdr__logo" href="/#top" aria-label="Такт – на главную">
        <TaktMark animated class="lhdr__mark" />
        <b>Такт</b><i>*</i>
      </a>
      <nav class="lhdr__links" aria-label="Разделы">
        <a v-for="l in LANDING_NAV" :key="l.href" :href="`/${l.href}`">{{ l.label }}</a>
        <a href="/docs">Документация</a>
      </nav>
      <div class="lhdr__right">
        <a v-if="!authenticated" class="lhdr__login" :href="pageRoutes.login">Войти</a>
        <button type="button" class="btn btn--dark" @click="start">{{ startLabel }}</button>
      </div>
      <button
        type="button"
        class="lhdr__burger"
        :aria-expanded="open"
        aria-label="Меню"
        @click="open = !open"
      >
        <span /><span />
      </button>
    </div>
    <div v-if="open" class="lhdr__sheet">
      <a v-for="l in LANDING_NAV" :key="l.href" :href="`/${l.href}`" @click="open = false">{{ l.label }}</a>
      <a href="/docs">Документация</a>
      <a v-if="!authenticated" :href="pageRoutes.login">Войти</a>
      <button type="button" class="btn btn--dark" @click="start">{{ startLabel }}</button>
    </div>
  </header>
</template>

<style scoped>
.lhdr {
  position: sticky;
  top: 0;
  z-index: 40;
}
/* Progressive blur instead of a solid bar: strong behind the nav, fading out below it.
   The light tint keeps dark text readable over the dark full-bleed section. */
.lhdr::before {
  content: "";
  position: absolute;
  inset: 0 0 -28px;
  z-index: -1;
  background: linear-gradient(rgba(255, 255, 255, 0.72), rgba(255, 255, 255, 0));
  backdrop-filter: blur(14px);
  -webkit-backdrop-filter: blur(14px);
  mask-image: linear-gradient(#000 55%, transparent);
  -webkit-mask-image: linear-gradient(#000 55%, transparent);
  pointer-events: none;
}
.lhdr::before { transition: background 0.3s; }
.lhdr--dark::before { background: linear-gradient(rgba(10, 10, 10, 0.5), rgba(10, 10, 10, 0)); }
.lhdr--dark .lhdr__in { color: #fff; }
.lhdr--dark .lhdr__mark { color: #fff; }
.lhdr--dark .lhdr__links a:hover { background: rgba(255, 255, 255, 0.12); }
.lhdr--dark .lhdr__login:hover { color: rgba(255, 255, 255, 0.75); }
.lhdr--dark .btn--dark { background: #fff; color: var(--ink); }
.lhdr--dark .lhdr__burger span { background: #fff; }
.lhdr__in {
  transition: color 0.3s;
  display: flex;
  align-items: center;
  gap: 24px;
  max-width: var(--maxw);
  height: 76px;
  margin: 0 auto;
  padding: 0 var(--gut);
}
.lhdr__logo { display: flex; align-items: center; gap: 8px; font: 600 19px var(--font-wordmark); }
.lhdr__logo i { font-style: normal; color: var(--orange); }
.lhdr__mark { width: 26px; height: 26px; color: var(--ink); }
.lhdr__links {
  display: flex;
  gap: 4px;
  margin: 0 auto;
  font-size: 14px;
}
.lhdr__links a { padding: 8px 14px; border-radius: 999px; transition: background 0.2s; }
.lhdr__links a:hover { background: rgba(0, 0, 0, 0.05); }
.lhdr__right { display: flex; align-items: center; gap: 18px; font-size: 14px; }
.lhdr__login:hover { color: var(--ink-2); }
.lhdr__burger { display: none; width: 40px; height: 40px; margin-left: auto; border: 0; background: transparent; cursor: pointer; }
.lhdr__burger span { display: block; width: 20px; height: 1.5px; margin: 6px auto; background: var(--ink); }
.lhdr__sheet { display: none; }

@media (max-width: 900px) {
  .lhdr__links, .lhdr__right { display: none; }
  .lhdr__burger { display: block; }
  .lhdr__sheet {
    display: grid;
    gap: 4px;
    padding: 8px var(--gut) 20px;
    border-bottom: 1px solid var(--line);
    background: #fff;
    font-size: 16px;
  }
  .lhdr__sheet a { padding: 10px 0; }
  .lhdr__sheet .btn { margin-top: 8px; }
}
</style>
