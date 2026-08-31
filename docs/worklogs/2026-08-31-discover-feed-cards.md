# Discover Your feed cards (2026-08-31)

## Requested

Under Discover, show “Your feed” as a horizontal list of large thumbnail cards,
with play and queue actions like the other listening surfaces.

## Implementation

- Added playable `audioUrl` data to followed-artist track feed items.
- Added a Discover-only horizontal card layout with large artwork, artist/date
  context, and play/queue controls for playable tracks.
- Kept the existing vertical feed layout for the standalone `/feed` page and
  dashboard embedding.

## Follow-up

- Removed the release-page flag action.
- Release track titles now open the standalone full-waveform track player at
  `/tracks/:id`; the release page keeps play and queue controls alongside them.
- Artist channel headers now place the profile link in the upper-right and give
  social links their own aligned “Find the artist elsewhere” section.
- Artist channel pages now show the bio below the banner, with latest releases
  placed below the live player; the archive is labeled “Sounds.”
