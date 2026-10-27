// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'

vi.mock('@tahti/db', () => ({
  prisma: {},
  Prisma: {},
  notifyJobOutcome: vi.fn(),
  syncActiveVersionToItem: vi.fn(),
  syncActiveVersionToTrack: vi.fn(),
}))

import { soundVersionFailedNotice } from './transcode-version.js'
import { releaseTrackVersionFailedNotice } from './transcode-release-track-version.js'

describe('version failure notices', () => {
  it('names the sound version and links to the sound', () => {
    expect(
      soundVersionFailedNotice({
        versionNumber: 3,
        sound: { id: 'snd-1', title: 'Night drive', channel: { userId: 'u1' } },
      }),
    ).toMatchObject({
      userId: 'u1',
      outcome: 'failed',
      title: 'Version 3 of "Night drive" could not be processed',
      url: '/studio/sounds/snd-1',
    })
  })

  it('names the release track and links to the release', () => {
    expect(
      releaseTrackVersionFailedNotice({
        releaseTrack: { title: 'Side A', release: { id: 'rel-1', userId: 'u2' } },
      }),
    ).toMatchObject({
      userId: 'u2',
      title: 'The new audio for "Side A" could not be processed',
      url: '/studio/releases/rel-1',
    })
  })
})
