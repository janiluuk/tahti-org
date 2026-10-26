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

const PREFIX = 'stats-audience-test-'

type SessionSeed = {
  countryCode?: string | null
  city?: string | null
  uaBrowser?: string | null
  uaDeviceType?: string | null
  referrerHost?: string | null
  isBot?: boolean
  soundId?: string | null
}

describe('GET /api/me/stats/audience', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelId: string
  let otherChannelId: string
  let soundId: string

  const seed = async (channel: string, count: number, data: SessionSeed) => {
    await prisma.listenSession.createMany({
      data: Array.from({ length: count }, (_, i) => ({
        channelId: channel,
        soundId: data.soundId ?? null,
        byFingerprint: `${PREFIX}${channel}-${i}-${Math.random()}`,
        byIpHash: 'x',
        source: 'CHANNEL_PAGE' as const,
        countryCode: data.countryCode ?? null,
        city: data.city ?? null,
        uaBrowser: data.uaBrowser ?? null,
        uaDeviceType: data.uaDeviceType ?? null,
        referrerHost: data.referrerHost ?? null,
        isBot: data.isBot ?? false,
      })),
    })
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      displayName: 'Audience Artist',
    })
    channelId = artist.channel!.id
    cookie = await sessionCookieFor(prisma, artist.id)
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
      displayName: 'Other Artist',
    })
    otherChannelId = other.channel!.id
    const sound = await prisma.sound.create({
      data: { channelId, title: 'Audience Track', status: 'READY', isPublic: true },
    })
    soundId = sound.id

    await seed(channelId, 12, {
      uaBrowser: 'Chrome',
      uaDeviceType: 'Desktop',
      soundId,
      countryCode: 'FI',
      city: 'Helsinki',
    })
    await seed(channelId, 6, {
      uaBrowser: 'Firefox',
      uaDeviceType: 'Smartphone',
      referrerHost: 'example.com',
      countryCode: 'SE',
      city: 'Malmö',
    })
    await seed(channelId, 2, {
      uaBrowser: 'Opera',
      uaDeviceType: 'Desktop',
      countryCode: 'FI',
      city: 'Oulu',
    })
    await seed(channelId, 7, { uaBrowser: 'Bot', uaDeviceType: 'Bot', isBot: true })
    await seed(otherChannelId, 9, { uaBrowser: 'Edge' })
  })

  afterAll(async () => {
    await prisma.listenSession.deleteMany({
      where: { channelId: { in: [channelId, otherChannelId] } },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const get = (query: string, withCookie = true) =>
    app.inject({
      method: 'GET',
      url: `/api/me/stats/audience?${query}`,
      headers: withCookie ? { cookie } : {},
    })

  it("gives shares of the artist's own human listens, small names folded into Other", async () => {
    const res = await get('dimension=browser&range=all')
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      dimension: 'browser',
      total: 20,
      minBucket: 5,
      items: [
        { name: 'Chrome', count: 12, share: 0.6 },
        { name: 'Firefox', count: 6, share: 0.3 },
        { name: 'Other', count: 2, share: 0.1 },
      ],
    })
  })

  it('counts bots only when asked', async () => {
    const res = await get('dimension=deviceType&range=all&includeBots=true')
    expect(res.json().total).toBe(27)
    expect(res.json().items).toContainEqual({ name: 'Bot', count: 7, share: 0.2593 })
  })

  it('names sources by referrer host, Direct without one', async () => {
    const res = await get('dimension=source&range=30')
    expect(res.json().items).toEqual([
      { name: 'Direct', count: 14, share: 0.7 },
      { name: 'example.com', count: 6, share: 0.3 },
    ])
  })

  it('names the surface each listen played on', async () => {
    const res = await get('dimension=surface&range=all')
    expect(res.json()).toMatchObject({
      dimension: 'surface',
      total: 20,
      items: [{ name: 'CHANNEL_PAGE', count: 20, share: 1 }],
    })
  })

  it('narrows to one track', async () => {
    const res = await get(`dimension=browser&range=all&soundId=${soundId}`)
    expect(res.json()).toMatchObject({
      total: 12,
      items: [{ name: 'Chrome', count: 12, share: 1 }],
    })
  })

  it('rejects an unknown dimension and anonymous callers', async () => {
    expect((await get('dimension=ip&range=all')).statusCode).toBe(400)
    expect((await get('dimension=browser', false)).statusCode).toBe(401)
  })

  it('lists countries and the cities enough listeners share', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/stats/locations?range=all',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({
      total: 20,
      minBucket: 5,
      countries: [
        { name: 'FI', countryCode: 'FI', count: 14, share: 0.7 },
        { name: 'SE', countryCode: 'SE', count: 6, share: 0.3 },
      ],
      cities: [
        { name: 'Helsinki', countryCode: 'FI', count: 12, share: 0.6 },
        { name: 'Malmö', countryCode: 'SE', count: 6, share: 0.3 },
      ],
    })
  })
})
