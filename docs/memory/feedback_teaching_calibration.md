---
name: Calibrate complexity — user is learning backend, not production-senior
description: User is solo master's student learning Go from scratch; avoid presenting senior-level patterns as "must have from day 1"
type: feedback
originSessionId: 4d07de0a-84f0-4563-b2b7-e26a2bcc8a82
---
Пользователь — соло-разработчик, учит Go с нуля, впервые делает production backend. Сильный на frontend (Nuxt/Vue), но в backend — ноль опыта. Честно сказал «половину того что ты описал не очень понятно».

**Why:** После моей секции 3 (senior-уровня дизайн с RLS, event sourcing, contract testing, go-arch-lint, OpenAPI-first, testcontainers) пользователь сказал, что половина непонятна. Это правильный сигнал — я overshot. Для соло-магистра важнее ПОНЯТЬ и УСПЕТЬ, чем сделать идеально по учебнику Senior Go Engineer.

**How to apply:**
- Любое новое понятие — либо объясняю в тексте прямо там, либо предлагаю простой fallback.
- Различаю: MVP-essentials (без этого не работает) vs progressive-enhancements (добавим, когда созреет).
- Не предлагаю сразу 10 библиотек — стартую с минимального набора (3–4), остальное появляется по мере роста проекта.
- Каждое «сложное» архитектурное решение проверяю: «а что страшного случится, если начать проще и добавить позже?» Если ответ «ничего» — стартуем проще.
- Для каждой группы концепций предлагаю learning-путь: что почитать/посмотреть сначала.
- Перед каждой секцией дизайна спрашиваю: «это понятно или нужно разжевать?»
- Помню, что лучшая архитектура — та, которую автор понимает и может изменить, а не та, что красиво выглядит на схеме.
