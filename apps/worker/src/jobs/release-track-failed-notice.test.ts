// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'

vi.mock('@tahti/db', () => ({ prisma: {}, Prisma: {}, notifyJobOutcome: vi.fn() }))

import { releaseTrackFailedNotice } from './transcode-release-track.js'

describe('releaseTrackFailedNotice', () => {
  it('tells the release owner and links to the release', () => {
    expect(
      releaseTrackFailedNotice({ title: 'Side A', releaseId: 'rel-1', release: { userId: 'u1' } }),
    ).toEqual({
      userId: 'u1',
      outcome: 'failed',
      title: '"Side A" could not be processed',
      body: 'Upload the audio for this release track again.',
      url: '/studio/releases/rel-1',
    })
  })
})
