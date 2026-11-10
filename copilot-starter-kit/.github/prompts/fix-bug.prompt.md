---
name: fix-bug
description: Diagnose and fix a specific frontend bug with minimal changes.
agent: agent
---

Diagnose and fix the bug described in the chat.

1. Inspect the exact error/symptom and the smallest relevant set of files.
2. Trace the root cause before editing.
3. Make the smallest safe fix; do not rewrite unrelated code.
4. Preserve current design and functionality.
5. Run the most relevant available check and inspect the diff.
6. Report root cause, files changed, checks actually run, and any remaining uncertainty.

If the reproduction details are insufficient to distinguish between materially different causes, ask one concise question before editing.
