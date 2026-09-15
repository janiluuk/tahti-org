# Selective-bloom background visualizer preset

Status: open, not started.

## Request

Add a new background visualizer preset modeled on Three.js's selective
bloom post-processing example
(https://threejs.org/examples/webgl_postprocessing_unreal_bloom_selective.html):
glowing elements with `UnrealBloomPass`-style selective bloom. All of the
preset's parameters and its movement should be modulated over time —
either a subtle ambient drift, or tied to audio reactivity (artist's
choice) — and the modulation parameters should be exposed in the
existing visual-preset config dialog, same as the other presets.

## Where this plugs in (M31 visualizer system)

- `packages/shared/src/dto/visual-preset.ts`: `VISUAL_PRESETS` — the 11
  existing Three.js ambient presets (`WATER_RIPPLE`, `WAVEFORM_BARS`,
  `PARTICLE_FIELD`, `AURORA`, `REACTIVE_GRID`, `CLOUDSCAPE`,
  `LINE_TANGLE`, `BACKDROP_BOX`, `LENS_FLARES`, `IES_SPOTLIGHT`, plus
  `MINIMAL`/none). Each has a label + one-line description here; a new
  `BLOOM`-style entry would follow the same pattern. Several existing
  presets already describe audio-reactive behavior ("glowing brighter
  with the music" for `IES_SPOTLIGHT`, "subtle audio-reactive glow" for
  `CLOUDSCAPE`) — worth reading those implementations first as the
  closest precedent for "subtle vs. audio-reactive" modulation.
- `apps/web/src/components/visuals/` — one file per preset (e.g.
  `aurora-preset.tsx`, `ies-spotlight-preset.tsx`, `lens-flares-preset.tsx`).
  A new preset is a new file here, wired into
  `apps/web/src/components/visuals/channel-visualizer.tsx` (the switch
  that mounts the active preset) and `visual-preset-picker.tsx` /
  `visual-preset-thumbs.tsx` / `visual-preset-icons.tsx` (picker UI).
- `apps/web/src/app/dashboard/channel-visual-preset-panel.tsx` — the
  config dialog. `Channel.visualSettingsJson`
  (`packages/db/prisma/schema.prisma` ~line 1345) already stores
  per-preset knobs as `{ [VisualPreset]: { speed, intensity } }` — the
  new preset's modulation parameters (e.g. bloom strength/radius/
  threshold, drift speed, an audio-reactivity toggle) should extend this
  same JSON-knob pattern rather than adding new dedicated columns.
- `apps/web/src/components/ui/bg-canvas.tsx` — the separate site-wide
  ambient background canvas (distinct from the per-channel visualizer
  above) already wires an `AnalyserNode` in for audio reactivity and
  already imports `three` — if "background visualizer" means this
  site-wide canvas rather than the per-channel M31 system, scope
  differs; needs clarifying which surface this preset targets.
- There's also a separate, string-typed `backgroundVisualPreset`
  (`Channel.backgroundVisualPreset`, distinct enum subset —
  `INTERACTIVE_POINTS`, `FAT_LINES`, etc., defined in
  `packages/shared/src/dto/visual-preset.ts`) for the channel-page
  Backdrop tab specifically, separate from the header `visualPreset`
  above — a third candidate surface. Needs a decision on which of these
  three ("header visualPreset", "page Backdrop backgroundVisualPreset",
  or the site-wide `bg-canvas.tsx`) this new preset belongs to before
  starting.

## Feasibility notes

- `three` (`^0.184.0`, already a dependency in `apps/web/package.json`)
  ships `EffectComposer` / `UnrealBloomPass` under
  `three/examples/jsm/postprocessing/` — no new package needed.
- No existing usage of `EffectComposer`/postprocessing anywhere in the
  repo yet — this would be the first, so budget time for wiring a
  composer pass into whichever preset-mounting scene it lands in rather
  than assuming a drop-in.
