// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'

vi.mock('@tahti/db', () => ({ prisma: {}, Prisma: {}, notifyJobOutcome: vi.fn() }))

import { fingerprintMatchNotice, releaseTrackFailedNotice } from './transcode-release-track.js'

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

describe('fingerprintMatchNotice', () => {
  it('names the matched recording and links to the release', () => {
    expect(
      fingerprintMatchNotice(
        { title: 'Side A', releaseId: 'rel-1', release: { userId: 'u1' } },
        { artist: 'Someone', title: 'Original' },
      ),
    ).toMatchObject({
      userId: 'u1',
      title: '"Side A" matches a recording already out there',
      body: expect.stringContaining('AcoustID knows it as Someone – Original.'),
      url: '/studio/releases/rel-1',
    })
  })
})
