// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Suspended and deleted accounts are hidden from lists, search and messaging. */
export const availableUserWhere = { deletedAt: null, suspendedAt: null } as const

/** Keeps tracks by suspended and deleted accounts out of discovery lists,
 * the same rule search applies to its results. */
export const listedArtistSoundWhere = {
  channel: { user: availableUserWhere },
} as const
