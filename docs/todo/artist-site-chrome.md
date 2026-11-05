# Artist site chrome

**Status:** partial

Lets an artist choose which Tahti chrome shows around their channel when it is opened on its own site (`yourname.tahti.live` or a verified custom domain). The player side (Channel Designer controls and the subdomain shell) is in the tahti-player main checkout's uncommitted work (`ArtistSiteHeader`, `channelChromeStore`, `artist-subdomain-chrome.md`).

## Done

- [x] Migration `20261105180000_channel_site_chrome`: `Channel.showSiteSidebar` (default false), `showSiteBottomBar` (default false), `showSiteHeader` (default true).
- [x] `ChannelVisualPatchSchema` and `CHANNEL_VISUAL_SELECT` accept and return the three booleans; `PATCH/GET /api/me/channel/visual` save and read them.
- [x] `GET /api/channels/:slug` (`PublicChannelViewSchema`) returns them to visitors.
- [x] Tests: shared schema (accepts both values, rejects non-booleans); API integration (owner save → reload → anonymous public read → clear; invalid value 400), run in CI.

## Left

- [ ] Deploy the migration and API before the player ships the artist-site shell.
- [ ] Player: finish and ship the designer controls and subdomain shell (tahti-player).
