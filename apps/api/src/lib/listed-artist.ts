// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Keeps tracks by suspended and deleted accounts out of discovery lists,
 * the same rule search applies to its results. */
export const listedArtistSoundWhere = {
  channel: { user: { deletedAt: null, suspendedAt: null } },
} as const
