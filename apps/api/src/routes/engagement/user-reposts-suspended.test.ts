// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'repost-susp-'

describe('public reposts and suspended accounts', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let fanId: string
  let suspendedArtistId: string
  const fanName = `${PREFIX}fan`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: fanName,
    })
    fanId = fan.id
    const kept = await createTestArtist(prisma, {
      email: `${PREFIX}kept@example.com`,
      username: `${PREFIX}kept`,
    })
    const suspended = await createTestArtist(prisma, {
      email: `${PREFIX}suspended@example.com`,
      username: `${PREFIX}suspended`,
    })
    suspendedArtistId = suspended.id
    const keptTrack = await createReadySound(prisma, kept.channel!.id, 'Kept repost')
    const goneTrack = await createReadySound(prisma, suspended.channel!.id, 'Suspended repost')
    await prisma.soundRepost.createMany({
      data: [
        { userId: fan.id, soundId: keptTrack.id },
        { userId: fan.id, soundId: goneTrack.id },
      ],
    })
    await prisma.user.update({
      where: { id: suspendedArtistId },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it("leaves out reposts of a suspended artist's tracks", async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/u/${fanName}/reposts` })
    expect(res.statusCode).toBe(200)
    expect(res.json().items.map((i: { title: string }) => i.title)).toEqual(['Kept repost'])
  })

  it("does not show a suspended account's reposts", async () => {
    await prisma.user.update({
      where: { id: fanId },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
    const res = await app.inject({ method: 'GET', url: `/api/v1/u/${fanName}/reposts` })
    expect(res.statusCode).toBe(404)
  })
})
