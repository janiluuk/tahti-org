// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import {
  ReleaseTrackVersionCompleteSchema,
  ReleaseTrackVersionCreatedSchema,
  ReleaseTrackVersionListSchema,
  ReleaseTrackVersionPrepareResponseSchema,
  ReleaseTrackVersionPrepareSchema,
  ReleaseTrackVersionViewSchema,
} from './release-track-version.js'

describe('release track version DTOs (PLAT-014 phase 3)', () => {
  const view = {
    id: 'v1',
    versionNumber: 1,
    versionLabel: 'Original',
    status: 'READY',
    isActive: true,
    durationSec: 240,
    createdAt: '2026-06-01T00:00:00.000Z',
  }

  it('parses version view and list', () => {
    expect(ReleaseTrackVersionViewSchema.safeParse(view).success).toBe(true)
    expect(ReleaseTrackVersionListSchema.safeParse([view]).success).toBe(true)
  })

  it('parses prepare and complete bodies', () => {
    expect(
      ReleaseTrackVersionPrepareSchema.safeParse({
        filename: 'track.wav',
        contentType: 'audio/wav',
      }).success,
    ).toBe(true)
    expect(
      ReleaseTrackVersionCompleteSchema.safeParse({
        uploadId: 'up_1',
        versionLabel: 'Remaster',
      }).success,
    ).toBe(true)
  })

  it('parses prepare response and created payload', () => {
    expect(
      ReleaseTrackVersionPrepareResponseSchema.safeParse({
        uploadId: 'up_1',
        uploadUrl: 'https://minio.example/upload',
        expiresAt: '2026-06-01T01:00:00.000Z',
      }).success,
    ).toBe(true)
    expect(
      ReleaseTrackVersionCreatedSchema.safeParse({
        versionId: 'v2',
        versionNumber: 2,
        versionLabel: 'Remaster',
        status: 'PENDING',
      }).success,
    ).toBe(true)
  })
})
