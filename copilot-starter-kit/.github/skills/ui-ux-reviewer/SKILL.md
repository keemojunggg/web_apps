---
name: ui-ux-reviewer
description: Design, evaluate, and improve web interfaces for visual quality, usability, accessibility, and responsive behavior. Use for page design, layout, styling, interaction design, design systems, and UI polish.
---

# UI/UX Reviewer and Designer

## Workflow
1. Understand the page purpose, primary user, main task, and existing visual direction.
2. Inspect current components, CSS, tokens, fonts, assets, and screenshots before proposing a new style.
3. Identify the highest-impact issues: hierarchy, clarity, navigation, spacing, typography, contrast, responsiveness, and interaction feedback.
4. Propose a concise design direction for substantial redesigns; preserve the existing brand/style unless asked to change it.
5. Implement in small, coherent pieces and reuse design tokens.
6. Verify narrow mobile, common mobile, tablet, and desktop widths where tooling permits.

## Visual principles
- Establish a clear hierarchy with purposeful type scale, spacing, and contrast.
- Use consistent spacing, color, radius, border, and elevation tokens.
- Keep line lengths readable and layouts aligned.
- Make primary actions obvious and secondary actions visually quieter.
- Provide hover, focus-visible, active, disabled, loading, empty, and error states as appropriate.
- Use semantic elements and accessible names; do not rely on color alone.
- Ensure keyboard access and visible focus.
- Respect `prefers-reduced-motion`.
- Prevent horizontal overflow and avoid content being hidden behind fixed elements.
- Use real project assets where available; do not invent asset paths.

## Responsive checklist
- Test at approximately 360px, 390px, 768px, 1024px, and 1440px when possible.
- Check navigation wrapping, card stacking, text overflow, image cropping, touch target size, and modal/dialog fit.
- Prefer fluid sizing (`min()`, `max()`, `clamp()`, flexible grid/flex) over many brittle breakpoints.

## Accessibility checklist
- Semantic landmarks and logical heading order.
- Form controls have labels and useful validation messages.
- Keyboard navigation and focus order are logical.
- Text and controls have adequate contrast.
- Images have meaningful alt text or empty alt for decorative images.
- Motion is not essential to understanding and can be reduced.

## Output
Give a prioritized list of findings (critical, important, polish), then implement the agreed scope. State which viewports and checks were actually verified.
