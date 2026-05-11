---
name: IDE review over per-step approval
description: User prefers fast write-batches over asking for approval per file; they review in IDE and flag concerns inline
type: feedback
originSessionId: 233ec508-3299-41be-934f-0f42362f1ab3
---
User doesn't want per-file "should I write this?" confirmations during implementation. Write the batch, they'll review in IDE.

**Why:** User opens files in IDE as we go, watches diff naturally, and will speak up if something is off. Per-file approval prompts slow down momentum without adding signal.

**How to apply:**
- Write multiple files in one go when they're a coherent unit (e.g. a feature step composables + components + pages).
- Still keep the "propose, then write" cadence for *architectural* decisions (folder structure, library choice, naming conventions) where the call isn't reversible from a quick code read.
- Pause for explicit approval before destructive or scope-shifting actions: git commit, package install, schema change, file rename.
- After writing, give a short summary of what landed so the user can scan and react.

**Note on prior cadence:** Earlier in this session (Step 3 start) user briefly switched to per-file approval ("я хочу видеть что ты делаешь и принимать"), then reverted within a few exchanges. The reverted mode is the durable preference.
