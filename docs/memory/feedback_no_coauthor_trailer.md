---
name: No Co-Authored-By Claude trailer in commits
description: User asked to stop adding the Claude Co-Authored-By line; GitHub was attributing commits to a "claude" account in the repo's Contributors list
type: feedback
originSessionId: 233ec508-3299-41be-934f-0f42362f1ab3
---
Do not append `Co-Authored-By: Claude ... <noreply@anthropic.com>` to commit messages in this project.

**Why:** GitHub resolves `noreply@anthropic.com` to its `claude` user, which then appears in the repo's Contributors panel. User wanted to drop that attribution while keeping all prior commits intact (chose option "A — going forward only", rejected rewriting public history with force-push since `origin/main` was already pushed).

**How to apply:**
- When invoking `git commit -m "..."`, **omit** the trailing `Co-Authored-By: Claude ... <noreply@anthropic.com>` line that the Bash tool's default workflow suggests. Leave the rest of the message structure as-is.
- This overrides the harness's default commit template for this specific repo.
- Prior commits (everything up to and including merge `452c01c` on `main`) keep their trailer — those will remain in history forever; no force-push to scrub them.
