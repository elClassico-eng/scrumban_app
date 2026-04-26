---
name: Claim discipline — language must match implementation depth
description: Don't oversell features (e.g. "process mining system") if implementation is lighter; use cautious phrasing
type: feedback
originSessionId: 4d07de0a-84f0-4563-b2b7-e26a2bcc8a82
---
При формулировке фич и описаний в дипломе/продукте: язык должен честно отражать глубину реализации.

**Why:** Пользователь явно предупредил: если в тексте дипломной работы заявлено «process mining система», а в коде 1 график и пара if'ов — на защите вскроют. Преподаватели задают вопросы вглубь («где discovery алгоритмы? где conformance checking?»), и это рушит защиту. Лучше сильнее сделать, скромнее назвать.

**How to apply:** 
- Используй «inspired by X approaches» вместо «X system», если не делаешь X полноценно.
- Любое claim в spec/доке/продукте проходи проверкой: «если меня спросят на защите вглубь — что я покажу как доказательство?»
- Это касается всего: ML, process mining, AI, real-time, scalability и т.п.
- Минимальные пороги для статистики (N ≥ 30 для percentiles, N ≥ 3 спринтов для прогнозов) — продукт честно показывает «данных мало», не врёт пользователю.
- UX переводит цифры в действия (не «p95=4.2d», а «10% задач в Code Review дольше 4 дней — посмотри bottleneck»).
