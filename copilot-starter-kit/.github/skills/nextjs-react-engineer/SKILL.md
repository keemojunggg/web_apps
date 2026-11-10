---
name: nextjs-react-engineer
description: Build, modify, debug, and refactor Next.js, React, and TypeScript applications. Use when a task touches routes, components, hooks, data loading, forms, state, TypeScript errors, or app architecture.
---

# Next.js / React / TypeScript Engineer

## Workflow
1. Inspect `package.json`, router structure, framework version, and the target files.
2. Identify whether the project uses App Router or Pages Router.
3. Trace the relevant component, imports, props, styles, and call sites before editing.
4. State assumptions briefly. For broad changes, propose a small plan before implementation.
5. Implement the smallest complete change that follows existing conventions.
6. Run the most relevant available check and inspect the diff.

## Next.js rules
- Follow the installed Next.js version and the repository's existing router.
- In App Router, default to Server Components. Use `"use client"` only for state, effects, event handlers, or browser-only APIs.
- Keep client components near the interactive leaf of the component tree.
- Use route handlers/server actions/data-fetching patterns already established in the project.
- Use `next/link` for internal navigation and `next/image` when appropriate for project assets.
- Check metadata, loading, error, and not-found conventions where relevant.
- Do not move secrets into client components or `NEXT_PUBLIC_` variables unless they are explicitly intended to be public.

## React and TypeScript rules
- Prefer function components and explicit, useful prop types.
- Avoid `any`, unnecessary type assertions, and duplicated state.
- Keep effects for synchronization with external systems; do not use effects to derive values that can be calculated during render.
- Use stable keys and correct dependency arrays.
- Avoid premature abstractions; extract components when reuse, complexity, or readability justifies it.
- Handle async states and errors deliberately.

## Debugging checklist
- Read the complete relevant component and its styles.
- Inspect the exact error and line/stack trace.
- Check JSX nesting, return structure, imports, types, and conditional branches.
- Check client/server boundary violations and browser API usage.
- Fix the root cause, then run typecheck/lint/build scripts that exist.

## Output
Summarize the root cause, implementation, files changed, checks run, and any follow-up needed. Never claim unrun checks passed.
