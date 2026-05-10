---
name: English commit messages
description: Project convention — git commit messages always in English (matches existing repo history); translate Russian templates at commit time
type: feedback
---

All git commit messages in this repo MUST be written in English, even when the working/conversation language is Russian.

**Why:** consistency with the existing commit history. Every prior commit in `git log` is English (`feat:`, `chore:`, `docs:`, etc.). User flagged this immediately after I drafted a commit with a Russian body during the docs/code sync work (2026-05-10). Mixed-language history makes future search, changelog generation, and external review worse.

**How to apply:**
- Subject line: English, conventional-commit prefix (`feat:`, `fix:`, `docs:`, `chore:`, `refactor:`, etc.) — match the established style.
- Body: English, even when describing Russian-language documents.
- This applies to **every** commit in this repo, including ones drafted in plan files. If a plan shows a Russian commit message template, translate it to English at the moment of `git commit`.
- When dispatching subagents, include the rule in their prompt — they may not see this memory directly.
