---
name: frontend-performance
description: Audit and improve frontend loading speed, runtime performance, rendering cost, image/font delivery, and bundle size in Next.js and React applications.
---

# Frontend Performance Engineer

## Workflow
1. Identify the user-visible performance symptom and the affected route.
2. Inspect current architecture, dependencies, image/font usage, and data-loading path.
3. Measure or use available build/analyzer/browser evidence before optimizing.
4. Prioritize changes by impact and risk; avoid speculative micro-optimizations.
5. Re-check behavior and compare measurements when possible.

## Review areas
- Client JavaScript and unnecessary `"use client"` boundaries.
- Large dependencies and duplicate packages.
- Image dimensions, formats, lazy loading, and layout shift.
- Font loading and render-blocking resources.
- Repeated requests, waterfalls, caching, and server/client data boundaries.
- Large lists, expensive renders, and avoidable state updates.
- Core Web Vitals: LCP, INP, and CLS where measurement is available.

## Guardrails
- Do not add an optimization library without evidence and a clear benefit.
- Do not sacrifice accessibility, correctness, or maintainability for a marginal speed gain.
- Do not claim performance improvements without measurements or a clearly described code-level rationale.

## Output
List measured evidence, prioritized bottlenecks, proposed changes, actual checks, and remaining trade-offs.
