# Tahti design docs — read this first

If you (the agent) read only this file, you know where everything is.

## What we are aiming for

**Tahti ry** is a Finnish nonprofit broadcasting cooperative: artists run always-on
channels (live → archive fallback), listeners need no account, surplus returns to
artists. Product surfaces:

| Surface | Role |
| --- | --- |
| `apps/web` + `@tahti/ui` | Canonical hosted product (studio, channel, listen, admin) |
| [Tahti Player](https://github.com/janiluuk/tahti-player) (`beta.tahti.live`, separate repo) | Listen / studio client that talks to the same public API |
| `GET https://api.tahti.live/api` | Public Scalar / OpenAPI for integrators |

Visual truth for the **web app** is the **live UI** plus committed Docker-stack
captures in `docs/e2e-screenshots/` — not old HTML mockups.

## Read order

1. **Constitution** — `docs/CONSTITUTION.md`. Sacrosanct. Wins over any UX preference.
2. **Agent brief** — `docs/AGENT.md`. Mission, streaming rules, terminology.
3. **UI library** — `.cursor/rules/ui-library.mdc` + `packages/ui` (+ `reference/tokens.css` for legacy token names still cited in older notes).
4. **E2E screenshots** — `docs/e2e-screenshots/` (+ mobile sibling `docs/e2e-screenshots-mobile/`). Update after meaningful UI changes.
5. **Active design briefs:**
   - `docs/design/AGENT-INSTRUCTIONS.md` — conformance methodology
   - `docs/design/ground-rules.md` — density / no-scroll / big buttons
   - `docs/design/ux-overhaul.md` — “1 view, 1 purpose” structural aims
   - `docs/audio-editor.md` — pro audio editor baseline (M21)
6. **Literal method** — `docs/design/literal-reference-method.md` — match structure to **current** e2e screenshots + `@tahti/ui` shells; do not invent pages from memory.

## Out of scope here

- Marketing site `website/` — off limits unless the user asks (see `.cursor/rules/website-off-limits.mdc`).
- Org strategy / budget / roadmap — `docs/project-roadmap.md`, `docs/financial-model.md`, etc. Keep those; they are not UI ground truth.
