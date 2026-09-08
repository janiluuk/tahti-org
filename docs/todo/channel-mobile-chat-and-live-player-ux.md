# Channel page: mobile chat, live/replay indicator, live player title

**Status:** not started — backlog, captured verbatim from user request on
2026-09-08 for later work. No investigation beyond locating candidate files.

## Requests (as given)

1. Mobile: hide the chat panel by default; show it fullscreen when the user
   taps the chat button on the channel page.
2. Change the "Live" indicator to "Replay" when the channel is playing its
   rotation/fallback content rather than a real live broadcast.
3. Display the track title in the live player on the artist channel page.
4. Remove the "Profile" text link from the corner (of the channel page —
   confirm exact placement before removing).
5. Desktop: move the chat panel to the right edge of the screen.
6. Desktop: when the chat panel is closed, slide it to the right corner and
   leave only an expand icon visible (collapsed dock, not fully hidden).

## Candidate files (unverified — confirm before editing)

- Channel chat: `apps/web/src/app/c/[slug]/chat-panel.tsx`,
  `apps/web/src/app/c/[slug]/fan-chat-panel.tsx`
- Live/rotation state and channel page: `apps/web/src/app/u/[username]/page.tsx`
- Live player (waveform/now-playing on the artist channel):
  `apps/web/src/components/active-track-stage.tsx`,
  `apps/web/src/components/sound-item-playback.tsx` (see also
  [[sounds-player-artwork-overlay]] for the sibling waveform-overlay work
  just done in the dashboard list — the live player on `/u/[username]` may
  be a different component and needs its own check for a title display).
- "Profile" corner link: not yet located — grep in `apps/web/src/app/c` and
  `apps/web/src/app/u/[username]` for the channel page chrome/header.

## Notes

- Items 1, 5, 6 are one coherent chat-layout change (mobile: hidden ⇄
  fullscreen; desktop: right-edge dock that collapses to an icon) — likely
  one PR.
- Items 2 and 3 touch the live/rotation state and now-playing display —
  check how "is this really live vs. rotation fallback" is currently known
  client-side before assuming a new field is needed.
- Item 4 needs the exact corner/component confirmed with the user or a
  screenshot before removal, since no "Profile" text link turned up in a
  quick grep of the channel/public-profile routes.
