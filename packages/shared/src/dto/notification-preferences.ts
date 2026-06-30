// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'

export const NotificationPreferencesSchema = z.object({
  notifyMoneyMovesEmail: z.boolean(),
  notifyMoneyMovesInApp: z.boolean(),
  notifyListenerActivityEmail: z.boolean(),
  notifyWeeklyRecapEmail: z.boolean(),
})

export type NotificationPreferences = z.infer<typeof NotificationPreferencesSchema>

export const PatchNotificationPreferencesSchema = NotificationPreferencesSchema.partial()

export type PatchNotificationPreferencesInput = z.infer<typeof PatchNotificationPreferencesSchema>
