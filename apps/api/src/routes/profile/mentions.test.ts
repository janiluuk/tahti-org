// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'pub-mention-'

describe('M15 — public mentions API', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let targetId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const mentioner = await createTestArtist(prisma, {
      email: `${PREFIX}mentioner@example.com`,
      username: 'pub-mentioner',
    })
    const target = await createTestArtist(prisma, {
      email: `${PREFIX}target@example.com`,
      username: 'pub-mention-target',
    })
    targetId = target.id

    await prisma.mention.create({
      data: {
        mentionerUserId: mentioner.id,
        targetUserId: target.id,
        surface: 'BIO',
        sourceId: mentioner.id,
      },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('returns 404 when public mentions disabled', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/pub-mention-target/mentions',
    })
    expect(res.statusCode).toBe(404)
  })

  it('returns mentions when opted in', async () => {
    await prisma.user.update({
      where: { id: targetId },
      data: { publicMentionsEnabled: true },
    })

    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/u/pub-mention-target/mentions',
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ mentioner: { username: string } }>
    expect(body.length).toBe(1)
    expect(body[0]?.mentioner.username).toBe('pub-mentioner')
  })
})
