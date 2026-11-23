// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'
import { buildTopList, buildTopListsByDimension } from './top-lists.js'

const PREFIX = 'top-lists-lib-'
const GENRE = `${PREFIX}genre`

describe('top list ranking in SQL', () => {
  let artistId: string
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    artistId = artist.id
    const plan = [
      { name: 'five', listens: 5, contentType: 'TRACK' },
      { name: 'threeA', listens: 3, contentType: 'TRACK' },
      { name: 'threeB', listens: 3, contentType: 'DJ_SET' },
      { name: 'one', listens: 1, contentType: 'DJ_SET' },
      { name: 'none', listens: 0, contentType: 'TRACK' },
    ] as const
    for (const row of plan) {
      const sound = await prisma.sound.create({
        data: {
          channelId: artist.channel!.id,
          title: row.name,
          genre: GENRE,
          contentType: row.contentType,
          status: 'READY',
          isPublic: true,
        },
      })
      ids[row.name] = sound.id
      if (row.listens > 0) {
        await prisma.listenEvent.createMany({
          data: Array.from({ length: row.listens }, (_, n) => ({
            soundId: sound.id,
            dedupeKey: `fp:${n}`,
            dayBucket: '2026-11-01',
          })),
        })
      }
    }
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('returns only the top N, ties broken by sound id', async () => {
    const [firstTie] = [ids.threeA!, ids.threeB!].sort()
    const top = await buildTopList(prisma, { genre: GENRE, limit: 2 })
    expect(top.map((e) => [e.soundId, e.listens])).toEqual([
      [ids.five, 5],
      [firstTie, 3],
    ])
    expect(top[0]).toMatchObject({ title: 'five', genre: GENRE, contentType: 'TRACK' })
  })

  it('ranks least-listened first for asc, still skipping unplayed tracks', async () => {
    const [firstTie] = [ids.threeA!, ids.threeB!].sort()
    const bottom = await buildTopList(prisma, { genre: GENRE, limit: 2, sort: 'asc' })
    expect(bottom.map((e) => [e.soundId, e.listens])).toEqual([
      [ids.one, 1],
      [firstTie, 3],
    ])
  })

  it('keeps the top entries per bucket, busiest bucket first', async () => {
    const buckets = await buildTopListsByDimension(prisma, {
      dimension: 'type',
      userId: artistId,
      limitPerBucket: 1,
    })
    expect(buckets.map((b) => [b.bucket, b.entries.map((e) => [e.soundId, e.listens])])).toEqual([
      ['TRACK', [[ids.five, 5]]],
      ['DJ_SET', [[ids.threeB, 3]]],
    ])
  })
})
