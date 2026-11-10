---
name: frontend-debugger
description: Diagnose and fix frontend bugs in Next.js, React, TypeScript, CSS, browser behavior, and build tooling. Use when the user reports an error, broken layout, missing asset, failed animation, or unexpected behavior.
---

# Frontend Debugger

## Diagnose before editing
1. Capture the exact symptom, error message, reproduction steps, and expected behavior.
2. Inspect the relevant source, imports, package scripts, config, and related styles.
3. Trace the data and render path; check browser/server boundaries.
4. Form the smallest testable hypothesis. Avoid speculative multi-change fixes.

## Common areas
- JSX/TSX: unbalanced tags/braces, invalid nesting, conditional rendering, missing keys.
- React: stale closures, effect dependencies, state updates, hydration mismatches.
- Next.js: Server/Client Component boundaries, route conventions, asset paths, metadata, dev origin/config.
- CSS: stacking contexts, overflow, positioning, flex/grid sizing, specificity, media queries.
- Assets: exact filename, case sensitivity, public path, import path, deployment path.
- Runtime: network status, console errors, failed requests, environment variables.

## Fix and verify
- Make one coherent root-cause fix.
- Avoid replacing a full file when a focused patch is sufficient.
- Run the narrowest available check, then build if appropriate.
- Explain any environment limitation separately from code defects.

## Output
Root cause → exact fix → files changed → verification → remaining uncertainty.
