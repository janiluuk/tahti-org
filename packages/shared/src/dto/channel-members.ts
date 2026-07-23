// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const ChannelMemberSchema = z.object({
  id: z.string(),
  name: z.string(),
  role: z.string(),
  pictureUrl: z.string().nullable(),
  position: z.number().int(),
})
export type ChannelMemberView = z.infer<typeof ChannelMemberSchema>

export const ChannelMemberListSchema = z.array(ChannelMemberSchema)

export const CreateChannelMemberSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(100),
  role: z.string().trim().min(1, 'role is required').max(100),
})

export const UpdateChannelMemberSchema = z.object({
  name: z.string().trim().min(1).max(100).optional(),
  role: z.string().trim().min(1).max(100).optional(),
})

export const ReorderChannelMembersSchema = z.object({
  ids: z.array(z.string()),
})
