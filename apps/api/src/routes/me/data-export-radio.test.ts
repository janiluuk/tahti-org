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

const PREFIX = 'export-radio-'

describe('GET /api/me/data-export.json — radio submissions and station suggestions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
    const sound = await prisma.sound.create({
      data: { channelId: artist.channel!.id, title: 'Night drive', status: 'READY' },
    })
    await prisma.radioTrackSubmissionBatch.create({
      data: {
        submitterId: userId,
        channelId: artist.channel!.id,
        note: 'For the night rotation',
        items: {
          create: {
            soundId: sound.id,
            positionInBatch: 0,
            status: 'REJECTED',
            rejectionNote: 'Too quiet',
          },
        },
      },
    })
    await prisma.radioStationSuggestion.create({
      data: {
        submitterId: userId,
        name: 'Lumo FM',
        language: 'Finnish',
        streamUrl: `https://stream.example.fi/${PREFIX}lumo.mp3`,
      },
    })
  })

  afterAll(async () => {
    await prisma.radioStationSuggestion.deleteMany({ where: { submitterId: userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists the tracks sent to Tahti Radio and the stations suggested', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.radioSubmissions).toEqual([
      expect.objectContaining({
        status: 'REJECTED',
        rejectionNote: 'Too quiet',
        sound: expect.objectContaining({ title: 'Night drive' }),
        batch: { note: 'For the night rotation' },
      }),
    ])
    expect(body.stationSuggestions).toEqual([
      expect.objectContaining({ name: 'Lumo FM', status: 'PENDING', language: 'Finnish' }),
    ])
  })
})
