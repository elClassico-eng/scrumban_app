---
name: Architectural rigor — user delivers sharp production-grade critique
description: User pushes architecture reviews to senior-level depth; take every critique literally and integrate
type: feedback
originSessionId: 4d07de0a-84f0-4563-b2b7-e26a2bcc8a82
---
Пользователь делает предметную архитектурную критику на уровне senior/mid+. Замечания конкретные и важные — не риторические.

**Why:** Получил от пользователя критику дизайна Scrumban с точными техническими указаниями: RLS для multi-tenancy, pub/sub для SSE при scale-out, precompute/event-sourcing для analytics, SPA вместо SSR для авторизованного продукта, feature flags. Это уровень знаний production-разработчика, не студента.

**How to apply:** 
- Каждое замечание пользователя воспринимать буквально, интегрировать в дизайн.
- Никакой «мягкой защиты» своих решений, если они слабее — открыто признавать и менять.
- Не упрощать ответ до ощущения «всё учёл», если что-то отложено — явно писать «в LATER» с причиной.
- В дизайне всегда обосновывать trade-off между «идеально» и «успеем сделать соло».
