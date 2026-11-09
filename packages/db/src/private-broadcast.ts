// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Channel filter that drops channels airing a PRIVATE session, which only the artist may hear. */
export const notPrivateLiveChannelWhere = {
  broadcasts: { none: { endedAt: null, visibility: 'PRIVATE' } },
} as const

/** Channel `broadcasts` select: non-empty when the open session is PRIVATE. */
export const privateLiveBroadcastSelect = {
  where: { endedAt: null, visibility: 'PRIVATE' },
  select: { id: true },
  take: 1,
} as const
