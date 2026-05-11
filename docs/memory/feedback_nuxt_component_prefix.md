---
name: Verify Nuxt component auto-import names before use
description: Nuxt prefixes components by folder path; forgot this twice during Phase 4, each time costing a confused-browser → debug → rename cycle
type: feedback
originSessionId: 233ec508-3299-41be-934f-0f42362f1ab3
---
When writing a component in a non-root folder of `app/components/`, **always** check `.nuxt/components.d.ts` for the registered name before referencing the component in templates.

**Rule:** Nuxt auto-imports components with their folder path as a PascalCase prefix.
- `app/components/analytics/CfdChart.vue` → `<AnalyticsCfdChart>` (no dedupe — file does not start with "Analytics")
- `app/components/sprint/SprintCard.vue` → `<SprintCard>` (dedupes — file starts with the folder's PascalCase)
- `app/components/workspace/WorkspaceSwitcher.vue` → `<WorkspaceSwitcher>` (dedupes)
- `app/components/board/CreateColumnModal.vue` → `<BoardCreateColumnModal>` (no dedupe)
- Special case: `app/components/AppHeader.vue` at the root → `<AppHeader>` (no prefix)

**Why:** Hit this in Step 2 (`<CreateWorkspaceModal>` should have been `<WorkspaceCreateModal>` — caused a blank modal click) and again in Step 4 (`<WipRecommendationsCard>` should have been `<AnalyticsWipRecommendationsCard>` — caused a runtime warning and blank chart card). Each time the user noticed via "nothing happens" UX and pasted a Vue warn, and I had to grep `.nuxt/components.d.ts` to confirm the auto-registered name. Cheaper to check upfront.

**How to apply:**
- After writing any component in a subfolder, run `grep -E "<ComponentBaseName>" .nuxt/components.d.ts` (after `bunx nuxt prepare` regenerates types) to confirm the exact exported name.
- When referencing the new component from a template for the first time, use the **full registered name**, not the file's base name.
- If the registered name is ugly (e.g. `<WorkspaceCreateWorkspaceModal>` from a file named `CreateWorkspaceModal.vue` in `workspace/`), rename the file to drop the redundant prefix (`workspace/CreateModal.vue` → `<WorkspaceCreateModal>`).
- For app-shell singletons (Header, Sidebar, Footer, Subnav) where a domain prefix is awkward, place the file in `components/` root rather than a subfolder.
