// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect } from 'vitest'
import type { JamEvent } from '@tahti/shared'
import { isLastJamEventFor } from './jam-stream.js'

const stateWith = (userIds: string[]): JamEvent => ({
  type: 'state',
  session: {
    id: 'jam-1',
    code: 'ABC234',
    hostUserId: 'host',
    collectionId: null,
    isPlaying: true,
    currentTrack: null,
    positionSec: 0,
    positionUpdatedAt: new Date(),
    createdAt: new Date(),
    endedAt: null,
    participants: userIds.map((userId) => ({
      userId,
      username: userId,
      displayName: userId,
      avatarUrl: null,
      role: userId === 'host' ? ('HOST' as const) : ('GUEST' as const),
      canControl: userId === 'host',
      joinedAt: new Date(),
    })),
  },
})

describe('isLastJamEventFor', () => {
  it('keeps the stream open while the listener is in the jam', () => {
    expect(isLastJamEventFor(stateWith(['host', 'guest']), 'guest')).toBe(false)
    expect(isLastJamEventFor(stateWith(['host', 'guest']), 'host')).toBe(false)
  })

  it('closes it once the listener left or was removed', () => {
    expect(isLastJamEventFor(stateWith(['host']), 'guest')).toBe(true)
  })

  it('closes it when the jam ends', () => {
    expect(isLastJamEventFor({ type: 'ended' }, 'host')).toBe(true)
  })
})
