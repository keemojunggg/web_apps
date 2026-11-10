---
name: review-ui
description: Review a page or component for UI quality, UX, accessibility, and responsiveness.
agent: ask
---

Review the specified page/component without editing files.

Inspect the relevant JSX/TSX, CSS, assets, and existing design conventions. Evaluate:
- visual hierarchy and clarity of the primary action
- typography, spacing, alignment, and consistency
- responsive behavior and overflow
- interaction states and feedback
- semantic HTML, keyboard access, focus, and contrast
- motion and reduced-motion support

Return findings grouped into Critical, Important, and Polish. For each finding, identify the affected file/area and give a concrete recommendation. Do not invent test results or claim visual verification without running it.
