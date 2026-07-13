# Скриншоты документации

Сюда кладутся PNG-иллюстрации для in-app docs. Ожидаемые файлы (light-тема, реальные данные):

- board-flow.png — канбан-доска с колонками и WIP-счётчиками → methodology/scrumban
- network-forecast.png — карточка «Сетевой прогноз · CPM + PERT» с критическим путём → math/cpm
- network-graph.png — раскрытый граф сети («Показать сеть») → math/cpm
- monte-carlo.png — карточка Monte Carlo (гистограмма + P50/85/95) → math/monte-carlo
- forecast-accuracy.png — карточка «Точность прогнозов» (таблица калибровки) → math/calibration
- simulator.png — страница симулятора (панель изменений + сравнение прогнозов + граф) → math/simulator

## roles/ — диаграммы ролей (сгенерированы, не скриншоты)

SVG-диаграммы вариантов использования по ролям для страницы `project/roles`. Генерируются из
`docs/uml/01-use-case/per-role/*.puml` командой:

```
plantuml -tsvg -o "$(pwd)/public/docs/roles" docs/uml/01-use-case/per-role/*.puml
```

Файлы: anonymous.svg, viewer.svg, member.svg, scrum-master.svg, admin.svg, owner.svg.
При изменении прав (RBAC) правится .puml, затем перегенерируются SVG — руками не редактировать.
