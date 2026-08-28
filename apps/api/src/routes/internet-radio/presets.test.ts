// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'inet-radio-preset-'

describe('GET /api/internet-radio/presets', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let presetId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    cookie = await sessionCookieFor(prisma, artist.id)

    const preset = await prisma.internetRadioPreset.create({
      data: {
        name: `${PREFIX}SomaFM`,
        genre: 'ambient',
        streamUrl: 'https://example.com/stream.m3u',
      },
    })
    presetId = preset.id
  })

  afterAll(async () => {
    await prisma.internetRadioPreset.deleteMany({ where: { id: presetId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/internet-radio/presets' })
    expect(res.statusCode).toBe(401)
  })

  it('lists presets for a signed-in user', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/internet-radio/presets',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      presets: Array<{ id: string; name: string; streamUrl: string | null }>
    }
    expect(body.presets.some((p) => p.id === presetId && p.name === `${PREFIX}SomaFM`)).toBe(true)
  })
})
