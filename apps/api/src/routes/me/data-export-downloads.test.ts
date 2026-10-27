// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'export-downloads-'

describe('GET /api/me/data-export.json — downloads and jams', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string
  let soundId: string
  const jamIds: string[] = []

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: `${PREFIX}fan`,
    })
    const host = await createTestArtist(prisma, {
      email: `${PREFIX}host@example.com`,
      username: `${PREFIX}host`,
    })
    cookie = await sessionCookieFor(prisma, fan.id)
    channelId = host.channel!.id
    const sound = await prisma.sound.create({
      data: { channelId, title: 'Free track', status: 'READY', isPublic: true },
    })
    soundId = sound.id
    const download = (byUserId: string | null, fp: string) => ({
      channelId,
      soundId,
      format: 'mp3_320',
      byUserId,
      byFingerprint: fp,
      byIpHash: 'ip',
      bytes: 1000,
    })
    await prisma.download.createMany({
      data: [download(fan.id, `${PREFIX}1`), download(null, `${PREFIX}2`)],
    })
    const jam = await prisma.jamSession.create({
      data: { hostUserId: host.id, code: `${PREFIX}JAM`.slice(0, 16) },
    })
    jamIds.push(jam.id)
    await prisma.jamParticipant.create({
      data: { sessionId: jam.id, userId: fan.id, role: 'GUEST' },
    })
  })

  afterAll(async () => {
    await prisma.jamSession.deleteMany({ where: { id: { in: jamIds } } })
    await prisma.download.deleteMany({ where: { channelId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists the account’s own downloads and the jams it joined', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.downloads).toEqual([
      expect.objectContaining({ channelId, soundId, format: 'mp3_320' }),
    ])
    expect(body.jams).toEqual([
      expect.objectContaining({
        role: 'GUEST',
        session: expect.objectContaining({ host: { username: `${PREFIX}host` } }),
      }),
    ])
  })
})
