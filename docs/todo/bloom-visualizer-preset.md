# Selective-bloom background visualizer preset

Status: open, not started.

**Target surface confirmed by user: `Channel.backgroundVisualPreset`**
(the page-level Backdrop tab, not the header `visualPreset` or the
site-wide `bg-canvas.tsx` — see "Where this plugs in" below for why that
matters: this surface currently has zero frontend UI at all.)

## Request

Add a new background visualizer preset modeled on Three.js's selective
bloom post-processing example
(https://threejs.org/examples/webgl_postprocessing_unreal_bloom_selective.html):
glowing elements with `UnrealBloomPass`-style selective bloom. All of the
preset's parameters and its movement should be modulated over time —
either a subtle ambient drift, or tied to audio reactivity (artist's
choice) — and the modulation parameters should be exposed in the
existing visual-preset config dialog, same as the other presets.

## Where this plugs in — `backgroundVisualPreset` is backend-only today

`Channel.backgroundVisualPreset` (`packages/db/prisma/schema.prisma`) and
its enum (`BACKGROUND_VISUAL_PRESETS = ['INTERACTIVE_POINTS', 'FAT_LINES',
'VIDEO_KINECT', 'BACKDROP_AREA']`, `packages/shared/src/dto/visual-preset.ts`
line ~253) are fully wired through the API — `apps/api/src/routes/channels/get.ts`,
`apps/api/src/routes/profile/public.ts`, `apps/api/src/routes/me/channel-visual.ts`
(the `PATCH` handler, via `ChannelVisualPatchSchema`) all read/write it —
but **no frontend component references it at all**. Checked (grep across
`apps/web/src`, zero hits): no picker UI, no renderer, and
`Channel.useBackgroundGradient` (the sibling boolean toggle for this same
Backdrop-tab surface) is equally unreferenced. This means:

- There is no existing "config dialog" for this surface to extend — one
  needs to be built (likely a new tab/section in
  `apps/web/src/app/dashboard/channel-visual-preset-panel.tsx`, next to
  the existing header-`visualPreset` config it already renders).
- There is no existing renderer component for any `backgroundVisualPreset`
  value either — `INTERACTIVE_POINTS`/`FAT_LINES`/`VIDEO_KINECT`/
  `BACKDROP_AREA` are schema-only placeholders with nothing behind them
  yet in `apps/web/src/components/visuals/`.
- There's also no `backgroundVisualSettingsJson`-equivalent column for
  per-preset knobs — the header `visualPreset` system has
  `Channel.visualSettingsJson` (`{ [VisualPreset]: { speed, intensity } }`,
  schema ~line 1345) for this; an equivalent field/schema needs adding
  for background presets since nothing analogous exists.

Net: this task is not "add one preset to an existing screen" — it's
"build the first background-preset renderer, its first config dialog,
and its first per-preset settings storage, using the new bloom preset
as the one that ships through all three." Worth confirming with the user
whether they actually want the whole backdrop-preset picker built now,
or whether they assumed it already existed (given the DB/API groundwork
looks complete) and the ask is really just "make backgroundVisualPreset
usable at all, starting with a bloom option."

Reference precedent for "subtle vs. audio-reactive" modulation: the
existing header-`visualPreset` presets in `apps/web/src/components/visuals/`
already do this (`ies-spotlight-preset.tsx` "glowing brighter with the
music", `cloudscape-preset.tsx` "subtle audio-reactive glow") — read
those implementations first, and `channel-visualizer.tsx` for how a
preset is mounted/switched, even though the target surface here is the
separate Backdrop system, not this one.

## Feasibility notes

- `three` (`^0.184.0`, already a dependency in `apps/web/package.json`)
  ships `EffectComposer` / `UnrealBloomPass` under
  `three/examples/jsm/postprocessing/` — no new package needed.
- No existing usage of `EffectComposer`/postprocessing anywhere in the
  repo yet — this would be the first, so budget time for wiring a
  composer pass into whichever preset-mounting scene it lands in rather
  than assuming a drop-in.
