// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'mention-api-'

describe('M15 — mention settings API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: 'mention-api-user',
    })
    cookie = await sessionCookieFor(prisma, user.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('PATCH /api/me/mentions/settings toggles mentionsEnabled', async () => {
    const off = await app.inject({
      method: 'PATCH',
      url: '/api/me/mentions/settings',
      headers: { cookie },
      payload: { mentionsEnabled: false },
    })
    expect(off.statusCode).toBe(200)
    expect(off.json().mentionsEnabled).toBe(false)

    const user = await prisma.user.findUnique({ where: { username: 'mention-api-user' } })
    expect(user?.mentionsEnabled).toBe(false)

    const bad = await app.inject({
      method: 'PATCH',
      url: '/api/me/mentions/settings',
      headers: { cookie },
      payload: { mentionsEnabled: 'no' },
    })
    expect(bad.statusCode).toBe(400)
  })

  it('mute and unmute handles', async () => {
    await createTestArtist(prisma, {
      email: `${PREFIX}target@example.com`,
      username: 'mention-target',
    })

    const mute = await app.inject({
      method: 'POST',
      url: '/api/me/mentions/mute/mention-target',
      headers: { cookie },
    })
    expect(mute.statusCode).toBe(201)

    const self = await app.inject({
      method: 'POST',
      url: '/api/me/mentions/mute/mention-api-user',
      headers: { cookie },
    })
    expect(self.statusCode).toBe(400)

    const unmute = await app.inject({
      method: 'DELETE',
      url: '/api/me/mentions/mute/mention-target',
      headers: { cookie },
    })
    expect(unmute.statusCode).toBe(200)

    const muter = await prisma.user.findUnique({ where: { username: 'mention-api-user' } })
    const targetUser = await prisma.user.findUnique({ where: { username: 'mention-target' } })
    const count = await prisma.mentionMute.count({
      where: { muterId: muter!.id, targetUserId: targetUser!.id },
    })
    expect(count).toBe(0)
  })
})
