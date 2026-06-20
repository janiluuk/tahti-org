# Tahti design docs — read this first

If you (the agent) read only this file, you know where everything is. No ambiguity, no contradictory older docs lurking in the tree.

1. **Constitution** — `docs/CONSTITUTION.md`. Sacrosanct. Governs *what* gets built; wins over any UX preference below.
2. **v8 mockups** — `docs/reference-screenshots/`. Visual ground truth for every page.
3. **Reference HTML pack** — `reference/tokens.css` + the canonical HTML files (`reference/components.html`, `reference/dashboard.html`, `reference/channel-live.html`, `reference/release.html`). Pixel-exact source for spacing, color, and structure — don't eyeball screenshots, read these.
4. **Active briefs, in implementation order:**
   - `docs/design/AGENT-INSTRUCTIONS.md` — design conformance methodology (v3): page shells, the reference/ pack, why screenshots alone aren't enough.
   - `docs/audio-editor.md` — pro audio editor baseline spec (M21).
   - `docs/design/ux-overhaul.md` — this UX overhaul brief (see below).
5. **This UX overhaul brief** — `docs/design/ux-overhaul.md`. The current structural rework: "1 view, 1 purpose," view-by-view redesigns, implementation order, and the smell test every view must pass before shipping.

## Referenced but not yet filed

The UX overhaul brief names three prior briefs ("design-reference-pack," "audio editor v3.2," "upload+collections") as part of the working spec. They aren't present as files in this repo — likely delivered as chat content in an earlier session and never saved. If you have the originals, add them here as `docs/design/<name>.md` and link them above. Until then, treat `docs/audio-editor.md` + `docs/reference-screenshots/audio-editor-v3.2.png` as the closest available reference for the audio editor.

## Superseded docs

Archived in `docs/_archive/` — see `docs/_archive/DEPRECATED.md` for what replaced each one. Do not use them as a reference.
