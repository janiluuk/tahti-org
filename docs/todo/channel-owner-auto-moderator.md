# Channel owner auto-moderator

**Status:** partial

## Goal

When a channel is created (artist signup / self-service provision), the
owner is automatically a `ChannelModerator` of their own channel. Existing
channels get the row on the next moderators list fetch. The owner cannot
remove themselves.

## Plan

1. [x] `ensureChannelOwnerModerator(prisma, channelId, userId)` upsert helper.
2. [x] Call from `createArtistAccount`, `channel-provision`, and
   `GET /api/me/channel/moderators`.
3. [x] `DELETE` rejects removing the channel owner; `/api/me/moderate` does not
   list the owned channel twice.
4. [x] API tests (PR [#1109](https://github.com/janiluuk/tahti-org/pull/1109)).
5. [ ] Player UI: no remove control on the owner row — slices 26–29 in
   [`../tahti-player/docs/todo/listener-stats-origin-url.md`](../../tahti-player/docs/todo/listener-stats-origin-url.md).
