# Port mobile chrome + Tahti-theme visuals → Tahti Player

Implementation is in the sibling player checkout (`../tahti-nuclear` or `../tahti-player`):

**`docs/todo/mobile-player-nav-and-tahti-theme-visuals.md`**

This repo (`apps/web` + `@tahti/ui`) is the visual reference only:

1. Mini-player stacked above bottom nav; fullscreen viz — `mini-player.tsx`, `StudioMobileNav`, `--mobile-nav-h`.
2. Thumbnail cover glow — `.listen-card::before` / `--card-bg-image`.
3. Discover gateway `BgCanvas` (`subtle`) — not channel presets.

Do not reimplement here unless the player work finds a missing API/palette contract.
