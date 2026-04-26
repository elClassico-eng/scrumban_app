---
name: Don't render SVG for learning materials — user has IDE PlantUML plugin
description: User reads .puml directly via PlantUML plugin in IDE; skip running `plantuml -tsvg` on learning materials
type: feedback
originSessionId: 4d07de0a-84f0-4563-b2b7-e26a2bcc8a82
---
Пользователь сказал: «у меня есть плагин который позволяет читать и видеть сгенерированную uml сразу в ide» — у него установлен PlantUML plugin в IDE (IntelliJ/WebStorm/GoLand), который показывает preview `.puml` файлов напрямую.

**Why:** Избежать мусора в git, не дублировать артефакты. SVG для диплома всё равно регенерируются перед вставкой в .docx/.pdf, промежуточные SVG не нужны.

**How to apply:**
- Для `learning/` подпапок — только `.puml` + `.md`, без SVG.
- Для диплом-версий (файлы в корне папок `01-use-case/`, `02-class/` и т.д.) — SVG создаются, но только когда пользователь явно просит или перед вставкой в текст.
- Не запускать `plantuml -tsvg` автоматически после создания `.puml`.
- В описаниях учебных материалов указывать «превью в IDE», а не «открыть SVG».
