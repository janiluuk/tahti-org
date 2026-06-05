// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { PrismaClient } from '@tahti/db'

vi.mock('../lib/stream-key-enc.js', () => ({
  decryptStreamKey: (enc: string) => enc.replace(/^enc:/, ''),
}))

import { processSocialPostDispatchJob } from './social-post-dispatch.js'

function prismaMock(post: object | null, conn: object | null) {
  return {
    socialPost: {
      findUnique: vi.fn().mockResolvedValue(post),
      update: vi.fn().mockResolvedValue({}),
    },
    socialConnection: {
      findUnique: vi.fn().mockResolvedValue(conn),
    },
  } as unknown as PrismaClient
}

describe('processSocialPostDispatchJob', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('posts to Mastodon and marks SENT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ id: 'mast-99' }),
      }),
    )

    const prisma = prismaMock(
      {
        id: 'post-1',
        userId: 'u1',
        platform: 'MASTODON',
        state: 'PENDING',
        message: 'Live now',
      },
      {
        platform: 'MASTODON',
        instanceUrl: 'https://mastodon.example',
        accessTokenEnc: 'enc:token',
        externalAccountId: null,
      },
    )

    await processSocialPostDispatchJob(prisma, 'post-1')

    expect(prisma.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'post-1' },
        data: expect.objectContaining({ state: 'SENT', externalId: 'mast-99' }),
      }),
    )
  })

  it('posts to Bluesky and marks SENT', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ uri: 'at://did:plc:x/app.bsky.feed.post/y' }),
      }),
    )

    const prisma = prismaMock(
      {
        id: 'post-2',
        userId: 'u1',
        platform: 'BLUESKY',
        state: 'PENDING',
        message: 'New release',
      },
      {
        platform: 'BLUESKY',
        instanceUrl: 'artist.bsky.social',
        accessTokenEnc: 'enc:jwt',
        externalAccountId: 'did:plc:test',
      },
    )

    await processSocialPostDispatchJob(prisma, 'post-2')

    expect(prisma.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          state: 'SENT',
          externalId: 'at://did:plc:x/app.bsky.feed.post/y',
        }),
      }),
    )
  })

  it('marks FAILED when connection is missing', async () => {
    const prisma = prismaMock(
      {
        id: 'post-3',
        userId: 'u1',
        platform: 'MASTODON',
        state: 'PENDING',
        message: 'orphan',
      },
      null,
    )

    await processSocialPostDispatchJob(prisma, 'post-3')

    expect(prisma.socialPost.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ state: 'FAILED', error: 'Social connection removed' }),
      }),
    )
  })
})
