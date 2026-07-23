// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const NotificationTypeSchema = z.enum(['NEW_POST'])

export const NotificationSchema = z.object({
  id: z.string(),
  type: NotificationTypeSchema,
  actor: z
    .object({
      username: z.string(),
      displayName: z.string(),
      avatarUrl: z.string().nullable(),
    })
    .nullable(),
  title: z.string(),
  body: z.string().nullable(),
  url: z.string().nullable(),
  readAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

export type NotificationView = z.infer<typeof NotificationSchema>

export const NotificationListSchema = z.object({
  notifications: z.array(NotificationSchema),
  unreadCount: z.number().int(),
})
