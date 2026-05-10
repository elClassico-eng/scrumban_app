---
name: Implementation division — backend by Claude, frontend collaborative
description: Claude реализует backend самостоятельно с краткими code-comments об ответственностях; frontend пишем совместно; Phase 0 pet-project пропущен
type: feedback
---

User делегирует backend implementation Claude'у, а frontend разрабатывают совместно.

**Why:** User сильный во frontend (Nuxt/Vue/TS), но новый в backend. Изначальный план «user сам пишет backend для понимания» оказался слишком тяжёлым. Найден компромисс 2026-04-26: Claude пишет backend, user учится через ревью реального production-кода. Это эффективнее, чем отдельный pet-project (Phase 0 notes-api), который теперь пропускается.

**How to apply:**
- **Backend (Phase 1+):** Claude реализует самостоятельно. После каждой логической секции (например, auth-модуль готов) — краткое объяснение «что сделано, какая ответственность у каждого файла, почему так». Не пересказ кода, а high-level смысл.
- **Code-comments:** МИНИМУМ. Только на non-obvious responsibility (1-2 строки в начале файла или над сложной функцией). Не докстринги-лекции, не описание WHAT (имена и типы это и так показывают). Только WHY где не очевидно.
- **Frontend:** пишем совместно. Я предлагаю компонент/страницу/store — user адаптирует под свой вкус. Особенно UI/UX — там user сильнее.
- **Phase 0 pet-project (notes-api):** пропущен. Plan-файл `docs/archive/2026-04-23-phase0-week1-nitro-starter.md` архивирован как референс рабочего setup'а Nuxt+Nitro+Drizzle, но не исполняется как sequential learning plan.
- **Перед сложными backend-решениями** (новая архитектурная развилка, нетривиальный паттерн) — дать user возможность задать вопросы прежде чем коммитить, чтобы он понимал логику решения.
- **При написании backend-кода:** консервативно — никаких преждевременных абстракций, никаких «на будущее». YAGNI ruthlessly.
