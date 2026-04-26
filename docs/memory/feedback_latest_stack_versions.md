---
name: Latest stable stack + strict typing + codegen mandatory
description: User требует последние стабильные версии всего стека, строгую TS-типизацию end-to-end и обязательную кодогенерацию контрактов между слоями
type: feedback
---

При выборе версий и инструментов всегда используй **последние стабильные** релизы. На 2026-04 это:
- **Nuxt 4** (НЕ Nuxt 3) — новая структура с `app/`, улучшенная TS-интеграция
- **Vue 3** последний (`<script setup lang="ts">` обязателен)
- **Pinia** последний
- **Tailwind CSS 4**
- **Nuxt UI v3** (база компонентов; **НЕ NextUI/HeroUI** — это для React)
- **Drizzle ORM** последний (с drizzle-kit)
- **Node.js 22 LTS+**
- **TypeScript** последний с `strict: true`

**Why:** Технологии быстро эволюционируют; устаревшие версии копят технический долг с дня 1. Для дипломного проекта в production-ready виде это особенно важно — на защите вопрос «почему legacy-версия?» сразу подрывает доверие. User конкретно запросил «самые последние, свежие и актуальные версии стека» 2026-04-26.

**How to apply:**
- Перед добавлением библиотеки → проверить latest stable версию (через context7 docs или официальный сайт). Не полагаться на тренировочные данные — они могут быть старше релизов
- Не использовать deprecated API (например, старый синтаксис useFetch)
- TypeScript strict mode НЕ опционален — никаких `any` без явного комментария «почему»
- **Кодогенерация типов между слоями обязательна:**
  - DB → код: `Drizzle infer` (`typeof users.$inferSelect`, `$inferInsert`)
  - HTTP request validation: zod schemas → static types из них же
  - HTTP контракт frontend ↔ backend: zod-to-openapi → openapi-typescript → typed client
  - Все типы пересекающие границу слоя — авто-сгенерированы, не написаны руками
- Nuxt UI: всегда v3+, **никогда не путать** с NextUI/HeroUI (React-only)
- При появлении новой major версии стека (mid-project) — обсудить миграцию, не игнорировать
