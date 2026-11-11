// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it } from 'vitest'
import {
  RELEASE_STEM_ROLES,
  ReleaseTrackStemCompleteSchema,
  ReleaseTrackStemPrepareSchema,
  ReleaseTrackStemViewSchema,
} from './release-track-stem.js'

describe('release track stem DTOs', () => {
  it('accepts the four stem roles', () => {
    expect([...RELEASE_STEM_ROLES]).toEqual(['vocals', 'drums', 'bass', 'other'])
    for (const role of RELEASE_STEM_ROLES) {
      expect(
        ReleaseTrackStemPrepareSchema.parse({
          role,
          filename: 'vocals.wav',
          contentType: 'audio/wav',
        }).role,
      ).toBe(role)
    }
  })

  it('rejects unknown roles', () => {
    expect(() =>
      ReleaseTrackStemCompleteSchema.parse({
        role: 'guitar',
        uploadId: 'releases/a/b/c-stem-vocals-x.wav',
      }),
    ).toThrow()
  })

  it('parses a stem view', () => {
    const view = ReleaseTrackStemViewSchema.parse({
      id: 'stem-1',
      role: 'drums',
      status: 'READY',
      durationSec: 120,
      audioUrl: 'https://cdn.example/stem.wav',
      createdAt: '2026-11-11T00:00:00.000Z',
    })
    expect(view.role).toBe('drums')
  })
})
