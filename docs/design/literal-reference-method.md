# Literal reference method (current product)

## Aim

Stop interpretive UI work. When changing a route in `apps/web`, match the
**current** product structure — not a remembered mockup and not a speculative
“should have.”

## Ground truth (in order)

1. **Live route** in `apps/web` under Docker / preview.
2. **Committed screenshot** in `docs/e2e-screenshots/` (and `docs/e2e-screenshots-mobile/` for narrow viewports) for that route — see `manifest.json`.
3. **Shared UI** from `@tahti/ui` / `packages/ui` (shells, Button, Panel, tokens). Prefer existing primitives over new markup.
4. **Design briefs** in this folder (`ground-rules.md`, `ux-overhaul.md`, `AGENT-INSTRUCTIONS.md`) for density and “1 view, 1 purpose.”

Old HTML/PNG mockup packs under `docs/reference-*` were removed. Do not recreate them.

## Working contract

When implementing or fixing a route:

### Rule A — structure-match the screenshot + shell

- Same primary regions as the e2e capture (header, main task, secondary panel).
- Same primary action placement; do not add extra studio chrome that is not on the shot unless the user asked for that feature.
- Use `@tahti/ui` layout shells for the surface (studio / brand / admin / public).

### Rule B — no invented sections

If the screenshot and the live route do not show a block, do not add it “because it seems useful.” New sections need an explicit product ask or a roadmap item.

### Rule C — verify with a capture

After meaningful UI changes, refresh `docs/e2e-screenshots/` via `./scripts/e2e-screenshots.sh` (local Docker). Do not copy shots into `website/`.

## Anti-patterns

- Treating [Tahti Player](https://github.com/janiluuk/tahti-player) beta screenshots as `apps/web` ground truth (different client).
- Eyeballing from marketing site mockups.
- Reintroducing discarded light-theme “Nordic” or newspaper layouts (see constitution + brand studio tokens).
