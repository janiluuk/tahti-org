// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { resolveClientApiUrl } from '@/lib/api-url'

export const API_BASE = resolveClientApiUrl()
export const PRESETS_KEY = 'tahti-admin-files-filter-presets'

export interface FilterPreset {
  name: string
  q: string
  userIds: string[]
  genres: string[]
  contentTypes: string[]
}

export interface EditFilePayload {
  title: string
  genre: string
  contentType: string
  isPublic: boolean
}
