# Stream manager on the artist studio page

User request: show the stream manager on the artist page, show the current
playlist name in the collapsed block as well, and remove it from the Go live
section.

## Status

Implemented on `cursor/stream-manager-artist-todo-5cae`.

## What changed

- Live stream manager stays on Studio overview (`/dashboard` `ChannelHero`) when
  the channel is on air. Rotation/playlist transport stays there too
  (`ChannelControlsPanel`).
- Offline hero is a Go live button (opens `/dashboard/broadcast`), not the
  “your channel is offline” status banner. Preview still uses the real Go live
  action.
- Collapsed rotation block shows the active playlist name (`Night Drive`, or
  `Default rotation`).
- Go live step no longer embeds the playlist manager. The top-nav status
  popover links to Studio overview when live, and to the Go live wizard when
  not — it does not open a playlist/stream modal.

Public `/u/[username]` profiles stay listener-facing.
