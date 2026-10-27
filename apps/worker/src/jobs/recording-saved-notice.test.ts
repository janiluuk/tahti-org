// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi } from 'vitest'

vi.mock('@tahti/db', () => ({
  prisma: {},
  soundOwnerDefaults: vi.fn(),
  notifyJobOutcome: vi.fn(),
}))

import { recordingSavedNotice } from './sound-broadcast.js'

describe('recordingSavedNotice', () => {
  it('says a published recording is a track', () => {
    expect(
      recordingSavedNotice({ id: 's1', title: 'Friday set', isPublic: true, ownerId: 'u1' }),
    ).toEqual({
      userId: 'u1',
      outcome: 'done',
      title: 'Your broadcast "Friday set" is now a track',
      body: null,
      url: '/studio/sounds/s1',
    })
  })

  it('says a draft needs publishing', () => {
    expect(
      recordingSavedNotice({ id: 's1', title: 'Friday set', isPublic: false, ownerId: 'u1' }),
    ).toMatchObject({
      title: 'Your broadcast "Friday set" is saved as a draft',
      body: 'Publish it from Studio when it is ready.',
    })
  })
})
