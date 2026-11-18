// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { z } from 'zod'
import {
  AdminTahtiSelectsBrowseItemSchema,
  AdminTahtiSelectsBrowseResponseSchema,
  AdminTahtiSelectsRotationItemSchema,
  AdminTahtiSelectsRotationResponseSchema,
} from './admin-tahti-selects.js'

/** Same shape as Selects admin rotation — separate OpenAPI names for the Radio channel. */
export const AdminTahtiRadioRotationItemSchema = AdminTahtiSelectsRotationItemSchema
export const AdminTahtiRadioRotationResponseSchema = AdminTahtiSelectsRotationResponseSchema
export const AdminTahtiRadioBrowseItemSchema = AdminTahtiSelectsBrowseItemSchema
export const AdminTahtiRadioBrowseResponseSchema = AdminTahtiSelectsBrowseResponseSchema

export type AdminTahtiRadioRotationItem = z.infer<typeof AdminTahtiRadioRotationItemSchema>
export type AdminTahtiRadioBrowseItem = z.infer<typeof AdminTahtiRadioBrowseItemSchema>
