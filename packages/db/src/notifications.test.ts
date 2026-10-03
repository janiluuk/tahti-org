// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, expect, it, vi } from 'vitest'
import type { PrismaClient } from '@prisma/client'
import {
  notifyArtistOfNewLike,
  notifyArtistOfNewRepost,
  notifyArtistOfRadioSubmissionRejected,
} from './notifications.js'

function fakePrisma() {
  const create = vi.fn().mockResolvedValue({})
  return { prisma: { notification: { create } } as unknown as PrismaClient, create }
}

const actor = { id: 'fan-1', username: 'fan', displayName: 'Fan' }
const item = { id: 'sound-1', title: 'Night Drive', channelSlug: 'artist-channel' }

describe('notification target urls', () => {
  it('links a new like to the loved track', async () => {
    const { prisma, create } = fakePrisma()
    await notifyArtistOfNewLike(prisma, 'artist-1', actor, item)
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'NEW_LIKE', url: '/t/sound-1' }),
    })
  })

  it('links a new repost to the reposted track', async () => {
    const { prisma, create } = fakePrisma()
    await notifyArtistOfNewRepost(prisma, 'artist-1', actor, item)
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({ type: 'NEW_REPOST', url: '/t/sound-1' }),
    })
  })

  it('links a rejected radio submission to the Tahti Radio submissions tab', async () => {
    const { prisma, create } = fakePrisma()
    await notifyArtistOfRadioSubmissionRejected(
      prisma,
      'artist-1',
      'Night Drive',
      'Too quiet for rotation',
    )
    expect(create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        type: 'RADIO_SUBMISSION_REJECTED',
        title: '"Night Drive" was not added to Tahti Radio',
        url: '/studio/channel?tab=tahti-radio',
      }),
    })
  })
})
