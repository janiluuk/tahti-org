# Channel look-extras persistence (2026-09-04)

## Summary

Channel Designer fields that Nuclear had been keeping only in
`localStorage` (`tahti.channelLookExtras.{slug}`) now persist on `Channel`
and round-trip through owner + public APIs.

## Columns added

| Column                                 | Notes                                     |
| -------------------------------------- | ----------------------------------------- |
| `usePlayerGradient`                    | bool, default false                       |
| `playerColorSchemeJson`                | JSON color scheme for player stage        |
| `useBackgroundGradient`                | bool, default false                       |
| `backgroundColorSchemeJson`            | JSON color scheme for page background     |
| `backgroundVisualPreset`               | string preset id (`INTERACTIVE_POINTS` …) |
| `nowPlayingOverlayStyle`               | string layout id                          |
| `nowPlayingOverlaySettingsJson`        | optional settings blob                    |
| `playerOverlayMode` / `Text` / `Align` | reuses `ChannelTextLayerMode` / `Align`   |
| `channelLinksJson`                     | JSON array of `{label,url}`               |

## Naming

- Designer **`textOverlay*`** → existing **`textLayer*`** (unchanged;
  `/api/me/channel/text-layer`).
- Designer **`playerOverlay*`** → new **`playerOverlay*`** columns (player
  stage only; not the RTMP `streamOverlay*`).
- **`backgroundVisualPreset`** is a `String?`, not `VisualPreset`, because
  backdrop widgets use ids outside that enum.

## Routes

- `GET`/`PATCH /api/me/channel/visual` — select/patch the new fields
  (`channelLinks` in the PATCH body → `channelLinksJson` in storage/response).
- `GET /api/channels/:slug` — includes look extras + existing
  `brandAccentPreset`.
- Public profile `channel` object — same look extras + `brandAccentPreset`.

Migration: `20260904030000_channel_look_extras`.
