<template>
  <div class="announce">
    Бета: бесплатно, возможны неточности, всё постоянно улучшается <b>·</b>
    <a href="/feedback">нашли проблему? оставьте отзыв →</a>
  </div>
</template>

<style scoped>
.announce {
  background: var(--ink);
  color: #fff;
  font: 12px/1.4 var(--font-mono);
  text-align: center;
  padding: 9px 16px;
}
.announce b { color: var(--orange); font-weight: 500; }
.announce a { text-decoration: underline; text-underline-offset: 3px; }
</style>
