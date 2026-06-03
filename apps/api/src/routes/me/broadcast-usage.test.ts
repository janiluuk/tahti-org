// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { hashPassword } from '../../lib/password.js'
import { createSession } from '../../lib/session.js'
import {
  FREE_WEEKLY_LIVE_CAP_SEC,
  FREE_WEEKLY_HARD_CAP_SEC,
  utcWeekStart,
} from '@tahti/shared/broadcast-cap'

const PREFIX = 'bcap-test-'

describe('M20 — broadcast usage', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let freeCookie: string
  let freeUserId: string
  let channelId: string
  let liveSourcePass: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const passwordHash = await hashPassword('testpassword')
    liveSourcePass = 'bcap-source-pass'
    const liveSourcePassHash = await hashPassword(liveSourcePass)
    const user = await prisma.user.create({
      data: {
        email: `${PREFIX}free@example.com`,
        passwordHash,
        username: 'bcap-free',
        displayName: 'Free Artist',
        tier: 'FREE',
        weeklyLiveSecondsUsed: FREE_WEEKLY_LIVE_CAP_SEC,
        weeklyLiveResetAt: utcWeekStart(new Date()),
        channel: {
          create: {
            slug: 'bcap-free',
            liveSourceMount: '/live/bcap-free',
            liveSourcePass,
            liveSourcePassHash,
            rtmpStreamKey: 'bcap-free__x',
            rtmpStreamKeyHash: 'x',
          },
        },
      },
      include: { channel: true },
    })
    freeUserId = user.id
    channelId = user.channel!.id
    freeCookie = `tahti_session=${(await createSession(prisma, user.id)).id}`
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('reports in grace at weekly cap (not hard blocked)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/broadcast-usage',
      headers: { cookie: freeCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().inGrace).toBe(true)
    expect(res.json().atCap).toBe(true)
    expect(res.json().blocked).toBe(false)
    expect(res.json().unlimited).toBe(false)
  })

  it('denies icecast connect during grace when offline', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_connect',
      payload: { mount: '/live/bcap-free', pass: liveSourcePass },
    })
    expect(res.statusCode).toBe(403)
    expect(res.body).toContain('weekly_cap')
  })

  it('denies icecast connect after grace period', async () => {
    await prisma.user.update({
      where: { id: freeUserId },
      data: { weeklyLiveSecondsUsed: FREE_WEEKLY_HARD_CAP_SEC },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_connect',
      payload: { mount: '/live/bcap-free', pass: liveSourcePass },
    })
    expect(res.statusCode).toBe(403)
    const usage = await app.inject({
      method: 'GET',
      url: '/api/me/broadcast-usage',
      headers: { cookie: freeCookie },
    })
    expect(usage.json().blocked).toBe(true)
  })

  it('denies unknown mount via Icecast form-encoded body', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_connect',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: 'mount=/live/no-such-channel&pass=x',
    })
    expect(res.statusCode).toBe(403)
  })

  it('allows icecast connect when under cap', async () => {
    await prisma.user.update({
      where: { id: freeUserId },
      data: { weeklyLiveSecondsUsed: 0, weeklyLiveResetAt: utcWeekStart(new Date()) },
    })
    const res = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_connect',
      payload: { mount: '/live/bcap-free', pass: liveSourcePass },
    })
    expect(res.statusCode).toBe(200)
    await prisma.broadcast.deleteMany({ where: { channelId } })
    await prisma.channel.update({ where: { id: channelId }, data: { state: 'OFFLINE' } })
  })
})
