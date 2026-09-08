# Channel page: mobile chat, live/replay indicator, live player title

**Status:** implemented on `feat/channel-mobile-chat-live-player-ux`.

## Goal

Channel listen UX polish from the 2026-09-08 request list.

## Plan

1. Mobile: hide chat by default; open fullscreen when the user taps Chat.
2. Header/player: show **REPLAY** when Icecast `signalConnected` is false but HLS
   is up (24/7 archive fallback / curated rotation); **LIVE** only for a real ingest.
3. Live player title: use `nowPlaying` metadata (poll while stream is up).
4. Remove the corner **Profile »** link from the channel artist header.
5. Desktop: right-edge chat rail; when collapsed, leave a dock expand control.

## Out of scope

- Chat panel / fan-chat logic dedupe (`remaining-work.md`)
- Discover/directory Live vs Replay labeling
