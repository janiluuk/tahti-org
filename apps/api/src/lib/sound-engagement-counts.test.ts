// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../test/helpers.js'
import { loadSoundEngagementCounts } from './sound-engagement-counts.js'

const PREFIX = 'sound-engagement-counts-'

describe('loadSoundEngagementCounts', () => {
  let channelId: string
  let soundIds: string[]
  let otherSoundId: string

  beforeAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    channelId = artist.channel!.id
    const fans = await Promise.all(
      [0, 1, 2].map((n) =>
        createTestArtist(prisma, {
          email: `${PREFIX}fan${n}@example.com`,
          username: `${PREFIX}fan${n}`,
        }),
      ),
    )
    const sounds = await Promise.all(
      ['busy', 'quiet', 'silent', 'other'].map((title) =>
        prisma.sound.create({ data: { channelId, title, status: 'READY', isPublic: true } }),
      ),
    )
    const [busy, quiet, , other] = sounds
    soundIds = sounds.slice(0, 3).map((s) => s.id)
    otherSoundId = other!.id

    await prisma.soundLike.createMany({
      data: [
        ...fans.map((fan) => ({ userId: fan.id, soundId: busy!.id })),
        { userId: fans[0]!.id, soundId: quiet!.id },
        { userId: fans[1]!.id, soundId: other!.id },
      ],
    })
    await prisma.comment.createMany({
      data: [
        { authorId: fans[0]!.id, soundId: busy!.id, body: 'a' },
        { authorId: fans[1]!.id, soundId: busy!.id, body: 'b' },
        { authorId: fans[2]!.id, soundId: other!.id, body: 'c' },
        { authorId: fans[2]!.id, channelId, body: 'channel wall, no sound' },
      ],
    })
    await prisma.listenEvent.createMany({
      data: [
        ...[1, 2, 3, 4, 5].map((n) => ({
          soundId: busy!.id,
          dedupeKey: `fp:${n}`,
          dayBucket: '2026-11-01',
        })),
        { soundId: quiet!.id, dedupeKey: 'fp:1', dayBucket: '2026-11-01' },
        { soundId: other!.id, dedupeKey: 'fp:1', dayBucket: '2026-11-01' },
      ],
    })
    const download = (soundId: string, counted: boolean) => ({
      channelId,
      soundId,
      format: 'mp3',
      byFingerprint: `${PREFIX}fp`,
      byIpHash: `${PREFIX}ip`,
      countedAt: counted ? new Date() : null,
    })
    await prisma.download.createMany({
      data: [
        download(busy!.id, true),
        download(busy!.id, true),
        download(busy!.id, false),
        download(quiet!.id, false),
        download(other!.id, true),
      ],
    })
  })

  afterAll(async () => {
    await prisma.download.deleteMany({ where: { channelId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('matches what Prisma _count plus the counted-download groupBy returned', async () => {
    const rows = await prisma.sound.findMany({
      where: { id: { in: soundIds } },
      select: {
        id: true,
        _count: { select: { likes: true, listenEvents: true, comments: true } },
      },
    })
    const downloads = await prisma.download.groupBy({
      by: ['soundId'],
      where: { soundId: { in: soundIds }, countedAt: { not: null } },
      _count: { _all: true },
    })
    const downloadsById = new Map(downloads.map((r) => [r.soundId, r._count._all]))
    const expected = Object.fromEntries(
      rows.map((r) => [
        r.id,
        {
          likeCount: r._count.likes,
          commentCount: r._count.comments,
          playCount: r._count.listenEvents,
          downloadCount: downloadsById.get(r.id) ?? 0,
        },
      ]),
    )

    const countsFor = await loadSoundEngagementCounts(prisma, [...soundIds, soundIds[0]!])
    const actual = Object.fromEntries(soundIds.map((id) => [id, countsFor(id)]))

    expect(actual).toEqual(expected)
    expect(actual[soundIds[0]!]).toEqual({
      likeCount: 3,
      commentCount: 2,
      playCount: 5,
      downloadCount: 2,
    })
    expect(actual[soundIds[2]!]).toEqual({
      likeCount: 0,
      commentCount: 0,
      playCount: 0,
      downloadCount: 0,
    })
  })

  it('only counts the requested sounds', async () => {
    const countsFor = await loadSoundEngagementCounts(prisma, soundIds)
    expect(countsFor(otherSoundId)).toEqual({
      likeCount: 0,
      commentCount: 0,
      playCount: 0,
      downloadCount: 0,
    })
  })

  it('returns zeros without querying for an empty list', async () => {
    const countsFor = await loadSoundEngagementCounts(prisma, [])
    expect(countsFor('missing').playCount).toBe(0)
  })
})
