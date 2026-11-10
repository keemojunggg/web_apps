# GitHub Copilot Starter Kit — Next.js / React / UI/UX

A lightweight, credit-conscious setup for VS Code GitHub Copilot.

## Included

- `.github/copilot-instructions.md` — project-wide coding rules.
- `.github/skills/` — focused skills for Next.js/React, UI/UX, debugging, and performance.
- `.github/prompts/` — reusable prompts for planning, implementation, UI review, bug fixing, and optimization.

## Install

1. Open your project folder in VS Code.
2. Copy the `.github` folder from this kit into the root of your project.
3. If `.github` already exists, merge the folders; do not overwrite existing files without reviewing them.
4. Open Copilot Chat and check that the repository instructions and skills are recognized by your VS Code/Copilot version.
5. Use the prompt picker in Copilot Chat to select the prompt files. Depending on your VS Code version, prompt invocation may appear as `/plan-feature`, `/fix-bug`, etc.

## Suggested workflow

- New feature: run `/plan-feature`, review the plan, then `/implement-feature`.
- UI polish: run `/review-ui`, agree on priorities, then ask Copilot to implement the selected findings.
- Bug: run `/fix-bug`.
- Performance: run `/optimize-frontend` after identifying the route or component.

## Credit-conscious habits

- Ask for a targeted review of named files/routes rather than "analyze the whole project".
- Use Ask mode for explanation, planning, and review without edits.
- Use Agent mode for bounded implementation tasks.
- Avoid repeated broad context scans and repeated speculative fixes.
- Ask for a concise diff and one relevant verification pass.
- Keep the model/task appropriate; use a stronger model only for genuinely complex architecture or debugging.

## Important

- Skills and prompts guide behavior; they do not guarantee correctness or increase your Copilot quota.
- Availability and exact UI labels depend on your VS Code and GitHub Copilot versions and plan.
- Keep secrets, tokens, private keys, and `.env` contents out of prompts and source control.
