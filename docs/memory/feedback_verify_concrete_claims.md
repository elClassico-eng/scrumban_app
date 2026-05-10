---
name: Verify concrete counts/claims with grep before writing
description: Every concrete number or "X correctly works" claim in audits, COMPACT.md, or Current docs must be ground-truthed by a direct grep/find on code in the same session. Don't rely on memory.
type: feedback
---

When summarizing what's correctly implemented — audit foundations, docs Current sections, COMPACT.md "Что сделано" entries — **every concrete count or "X works" claim must be re-verified against code in the current session by direct grep/find/wc**, not pulled from memory or earlier conversation.

**Why:** During the docs/code sync work on 2026-05-10, I wrote in the audit foundation (`docs/audit-2026-05-10-issues.md`) that RLS was enabled on "8 tenant-таблицах". A code-quality reviewer later ran `grep -rn "ENABLE ROW LEVEL SECURITY" drizzle/migrations/` and found exactly 6 tables enabled (`boards`, `board_columns`, `tasks`, `task_events`, `sprints`, `sprint_tasks`). The "8 tables" number was inherited from a prior session's mental model and never re-verified. The error then propagated into Task 2 (07-domain-model.md) and Task 3 (06-system-architecture.md) docs before being caught — required a cross-doc fix-up commit. Defense committee finds this same way: by grepping code, not by trusting prose.

**How to apply:**
- Before claiming any concrete count or "correctly working" status in a doc/audit/COMPACT entry, run an authoritative command:
  - RLS coverage: `grep -rn "ENABLE ROW LEVEL SECURITY" drizzle/migrations/ | wc -l`
  - Endpoint count: `find server/api -type f -name "*.ts" -not -name "*.test.ts" | wc -l`
  - Test count: `bun test 2>&1 | grep -E "pass|fail" | tail -3`
  - Schema files: `ls server/db/schema/ | wc -l`
  - Tables: same, derive from schema files OR `grep -E "^export const \w+ = pgTable" server/db/schema/*.ts | wc -l`
- For audit/snapshot docs: claims must be greppable AT THE TIME the audit is written. If something is later proven inaccurate, the audit stays as a historical record — but downstream docs based on it must be corrected.
- For Current sections in dual-track (Current/Target) docs: every Current claim must match a current grep result. If the grep returns differently from what the doc says, the doc is wrong (assuming the doc is supposed to follow code).
- Treat memory of past code state as a hypothesis, not a fact. The auto-memory's 13-day-old reminder ("Memories are point-in-time observations, not live state") applies here: a memory may have been correct when written, but code has since drifted.
- For master's-thesis defense in particular: every number in user-facing docs (audit, COMPACT, master spec, NFR matrix) must be re-greppable from the code at defense time. A single off-by-one or "we have N endpoints" mismatch becomes a credibility hit.
