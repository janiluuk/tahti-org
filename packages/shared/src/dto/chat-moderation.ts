// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

/** A chat message as the channel's owner and moderators see it. The sender's
 * fingerprint stays on the server: `canBan` and `banned` say what can be done
 * with it. */
export const ModerationChatMessageViewSchema = z.object({
  id: z.string(),
  handle: z.string(),
  text: z.string(),
  fanOnly: z.boolean(),
  channelRole: z.enum(['owner', 'moderator']).nullable(),
  createdAt: z.coerce.date(),
  canBan: z.boolean(),
  banned: z.boolean(),
})

export const ModerationChatMessageListSchema = z.object({
  messages: z.array(ModerationChatMessageViewSchema),
})
