// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const UserSearchHitSchema = z.object({
  username: z.string(),
  displayName: z.string(),
})

export const UserSearchListSchema = z.array(UserSearchHitSchema)
