// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { executeAccountDeletion } from './account-deletion.js'
import {
  cleanupUsersByEmailPrefix,
  cleanupVenuesBySlugPrefix,
  createTestArtist,
} from '../test/helpers.js'

const PREFIX = 'deletion-venue-shows-'
const log = { info: () => {}, warn: () => {}, error: () => {} } as never

describe('Account deletion calls off upcoming venue shows', () => {
  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await cleanupVenuesBySlugPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('cancels future shows and keeps past ones', async () => {
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
    })
    const venue = await prisma.venue.create({
      data: {
        slug: `${PREFIX}club`,
        name: 'Kellari',
        address: '1 Test St',
        city: 'Helsinki',
        createdBy: board.id,
      },
    })
    const future = await prisma.venueBroadcast.create({
      data: {
        venueId: venue.id,
        artistUserId: user.id,
        startAt: new Date(Date.now() + 86_400_000),
      },
    })
    const past = await prisma.venueBroadcast.create({
      data: {
        venueId: venue.id,
        artistUserId: user.id,
        startAt: new Date(Date.now() - 86_400_000),
        state: 'COMPLETED',
      },
    })

    await executeAccountDeletion(prisma, log, { userId: user.id, actorId: board.id })

    expect(
      (await prisma.venueBroadcast.findUniqueOrThrow({ where: { id: future.id } })).state,
    ).toBe('CANCELED')
    expect((await prisma.venueBroadcast.findUniqueOrThrow({ where: { id: past.id } })).state).toBe(
      'COMPLETED',
    )
  })
})
