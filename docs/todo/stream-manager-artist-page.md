# Stream manager on the artist studio page

User request: show the stream manager on the artist page, show the current
playlist name in the collapsed block as well, and remove it from the Go live
section.

## Current placement

- Live stats / chat / end-stream (`StreamManagerPanel`) sit in the dashboard
  home hero when the channel is already live (`_channel-hero.tsx`) and in the
  modal opened from the top-nav Go live pill (`_stream-manager-modal.tsx`).
- 24/7 rotation / playlist transport (`ChannelControlsPanel`) is duplicated:
  artist studio overview (`_dashboard-overview.tsx`), broadcast Control room,
  **and** the Go live step (`_step4-go-live.tsx`).
- The collapsed manager row shows a generic title plus now-playing track
  (`db-channel-controls--collapsed`). It does **not** show which playlist is
  active (`activePlaylist.name`, or “Default rotation”).

## Plan

1. Treat `/dashboard` (artist studio overview) as the home for stream +
   rotation management. Keep `StreamManagerPanel` there when live; keep
   `ChannelControlsPanel` there for 24/7 regardless of live state.
2. In the collapsed `ChannelControlsPanel` block, show the current playlist
   name next to the existing title / now-playing line.
3. Remove `ChannelControlsPanel` from the Go live step. Go live stays
   signal-check + the live button only. Stop stuffing playlist/stream
   management into that panel (and do not open the playlist manager from the
   Go live pill when the channel is not live).

## Files

- `apps/web/src/app/dashboard/channel-controls-panel.tsx` — collapsed label
- `apps/web/src/app/dashboard/broadcast/_step4-go-live.tsx` — remove manager
- `apps/web/src/app/dashboard/_stream-manager-modal.tsx` — Go live pill
- `apps/web/src/app/dashboard/_dashboard-overview.tsx` / `_channel-hero.tsx`

Do not put studio stream controls on the public `/u/[username]` artist
profile.
