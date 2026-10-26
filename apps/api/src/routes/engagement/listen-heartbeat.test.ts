// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'listen-heartbeat-test-'
const IPHONE_UA =
  'Mozilla/5.0 (iPhone; CPU iPhone OS 18_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.6 Mobile/15E148 Safari/604.1'

describe('POST /api/v1/listen/heartbeat', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string
  let soundId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Heartbeat Owner',
    })
    channelId = owner.channel!.id
    const sound = await prisma.sound.create({
      data: { channelId, title: 'Heartbeat Track', status: 'READY', isPublic: true },
    })
    soundId = sound.id
  })

  afterAll(async () => {
    await prisma.listenSession.deleteMany({ where: { channelId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const beat = (userAgent: string, fp: string) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/listen/heartbeat',
      headers: { 'user-agent': userAgent },
      payload: { soundId, source: 'CHANNEL_PAGE', fp },
    })

  it('stores coarse device labels, not the user agent', async () => {
    expect((await beat(IPHONE_UA, `${PREFIX}phone`)).statusCode).toBe(204)
    const session = await prisma.listenSession.findFirstOrThrow({
      where: { channelId, soundId, uaBrowser: 'Mobile Safari' },
    })
    expect(session).toMatchObject({
      uaBrowser: 'Mobile Safari',
      uaOs: 'iOS 18',
      uaDeviceType: 'Smartphone',
      uaDeviceVendor: 'Apple',
      isBot: false,
    })
    expect(
      JSON.stringify(session, (_k, v: unknown) => (typeof v === 'bigint' ? 0 : v)),
    ).not.toContain('AppleWebKit')
  })

  it('marks a crawler session as a bot', async () => {
    expect(
      (await beat('Googlebot/2.1 (+http://www.google.com/bot.html)', `${PREFIX}bot`)).statusCode,
    ).toBe(204)
    const bot = await prisma.listenSession.findFirstOrThrow({
      where: { channelId, soundId, isBot: true },
    })
    expect(bot.uaDeviceType).toBe('Bot')
  })
})
