// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { availableUserWhere } from '@tahti/db'

export { availableUserWhere }

/** Keeps tracks by suspended and deleted accounts out of discovery lists,
 * the same rule search applies to its results. */
export const listedArtistSoundWhere = {
  channel: { user: availableUserWhere },
} as const
