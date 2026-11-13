# Channel owner auto-moderator

**Status:** open

## Goal

When a channel is created (artist signup / self-service provision), the
owner is automatically a `ChannelModerator` of their own channel. Existing
channels get the row on the next moderators list fetch. The owner cannot
remove themselves.

## Plan

1. `ensureChannelOwnerModerator(prisma, channelId, userId)` upsert helper.
2. Call from `createArtistAccount`, `channel-provision`, and
   `GET /api/me/channel/moderators`.
3. `DELETE` rejects removing the channel owner; `/api/me/moderate` does not
   list the owned channel twice.
4. Tests + player UI: no remove control on the owner row.
