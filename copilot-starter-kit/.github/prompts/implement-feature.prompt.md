---
name: implement-feature
description: Implement a clearly specified feature using existing project conventions.
agent: agent
---

Implement the feature described in the chat.

- Inspect relevant files and follow the repository instructions.
- Reuse existing components, tokens, and patterns.
- Make the smallest complete implementation; avoid unrelated refactors.
- Preserve existing behavior outside the requested scope.
- Add accessible states and responsive behavior where relevant.
- Run the narrowest relevant checks available.
- Review the diff for accidental changes.

At the end, summarize behavior, files changed, checks actually run, and any manual verification needed. If requirements are materially ambiguous or the change is destructive, stop and ask before proceeding.
