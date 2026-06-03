// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import { computeReleaseChecklist } from './release-ops.js'

describe('computeReleaseChecklist', () => {
  const base = {
    title: 'EP',
    releaseDate: new Date('2024-06-01'),
    description: 'Notes',
    artworkUrl: 'https://cdn/a.jpg',
    state: 'DRAFT',
    upc: null,
    musicbrainzReleaseId: null,
    revelatorStatus: null,
    smartLinkTargets: null,
    tracks: [{ isrc: null }],
  }

  it('marks metadata done when basics present', () => {
    const steps = computeReleaseChecklist(base)
    expect(steps.find((s) => s.id === 'metadata')?.done).toBe(true)
    expect(steps.find((s) => s.id === 'published')?.done).toBe(false)
  })

  it('marks identifiers done with UPC', () => {
    const steps = computeReleaseChecklist({ ...base, upc: '123456789012' })
    expect(steps.find((s) => s.id === 'identifiers')?.done).toBe(true)
  })
})
