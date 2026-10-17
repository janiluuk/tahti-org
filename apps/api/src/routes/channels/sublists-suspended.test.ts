// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'sublist-susp-'
const LISTS = ['events', 'posts', 'embeds', 'members']

describe("a suspended artist's channel lists", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  const slug = `${PREFIX}artist`

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: slug,
      tier: 'ARTIST',
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('answers in good standing', async () => {
    for (const list of LISTS) {
      const res = await app.inject({ method: 'GET', url: `/api/channels/${slug}/${list}` })
      expect(res.statusCode, list).toBe(200)
    }
  })

  it('answers not found once the owner is suspended', async () => {
    await prisma.user.update({
      where: { username: slug },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
    for (const list of LISTS) {
      const res = await app.inject({ method: 'GET', url: `/api/channels/${slug}/${list}` })
      expect(res.statusCode, list).toBe(404)
    }
  })
})
