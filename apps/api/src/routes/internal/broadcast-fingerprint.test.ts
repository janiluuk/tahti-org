// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'
import {
  appendBroadcastFingerprintSegment,
  getBroadcastFingerprintSegments,
} from '../../lib/broadcast-fingerprint.js'
import { getRedisClient } from '../../lib/redis.js'
import { createTestArtist } from '../../test/helpers.js'

const SLUG = 'fp-ingest-test'

describe('broadcast fingerprint ingest (STREAM-008)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let broadcastId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()

    await prisma.broadcast.deleteMany({
      where: { channel: { slug: SLUG } },
    })
    await prisma.channel.deleteMany({ where: { slug: SLUG } })
    await prisma.user.deleteMany({ where: { username: SLUG } })

    const artist = await createTestArtist(prisma, {
      email: `${SLUG}@example.com`,
      username: SLUG,
    })
    const broadcast = await prisma.broadcast.create({
      data: {
        channelId: artist.channel!.id,
        source: 'ICECAST',
      },
    })
    broadcastId = broadcast.id
    await prisma.channel.update({
      where: { id: artist.channel!.id },
      data: { state: 'LIVE' },
    })
  })

  afterAll(async () => {
    await prisma.broadcast.deleteMany({
      where: { channel: { slug: SLUG } },
    })
    await prisma.channel.deleteMany({ where: { slug: SLUG } })
    await prisma.user.deleteMany({ where: { username: SLUG } })
    await app.close()
  })

  it('stores and retrieves segments in Redis', async (ctx) => {
    if (!(await getRedisClient())) ctx.skip()
    await appendBroadcastFingerprintSegment(broadcastId, {
      offsetSec: 0,
      durationSec: 12,
      fingerprint: 'AQAA_testfingerprint',
    })
    const segments = await getBroadcastFingerprintSegments(broadcastId)
    expect(segments.length).toBeGreaterThan(0)
    expect(segments[0]?.fingerprint).toBe('AQAA_testfingerprint')
  })

  it('POST /internal/broadcast/:id/fingerprint-segment requires auth', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/internal/broadcast/${broadcastId}/fingerprint-segment`,
      payload: { offsetSec: 30, durationSec: 12, fingerprint: 'AQAA_next' },
    })
    expect(res.statusCode).toBe(401)
  })

  it('POST /internal/broadcast/:id/fingerprint-segment appends segment', async (ctx) => {
    if (!(await getRedisClient())) ctx.skip()
    const res = await app.inject({
      method: 'POST',
      url: `/internal/broadcast/${broadcastId}/fingerprint-segment`,
      headers: { authorization: `Bearer ${config.internalSecret}` },
      payload: { offsetSec: 60, durationSec: 12, fingerprint: 'AQAA_via_api' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().ok).toBe(true)

    const segments = await getBroadcastFingerprintSegments(broadcastId)
    expect(segments.some((s) => s.fingerprint === 'AQAA_via_api')).toBe(true)
  })

  it('GET /api/channels/:slug/live-fingerprints returns active broadcast segments', async (ctx) => {
    if (!(await getRedisClient())) ctx.skip()
    await appendBroadcastFingerprintSegment(broadcastId, {
      offsetSec: 90,
      durationSec: 12,
      fingerprint: 'AQAA_public_read',
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${SLUG}/live-fingerprints`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().broadcastId).toBe(broadcastId)
    expect(res.json().segments.length).toBeGreaterThan(0)
  })

  it('GET live-fingerprints 404 when channel offline', async () => {
    const channel = await prisma.channel.findUnique({ where: { slug: SLUG } })
    await prisma.channel.update({ where: { id: channel!.id }, data: { state: 'OFFLINE' } })

    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${SLUG}/live-fingerprints`,
    })
    expect(res.statusCode).toBe(404)

    await prisma.channel.update({ where: { id: channel!.id }, data: { state: 'LIVE' } })
  })
})
