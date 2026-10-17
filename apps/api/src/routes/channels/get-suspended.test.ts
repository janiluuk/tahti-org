// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'chan-susp-'

describe("a suspended artist's channel page", () => {
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

  it('is served in good standing and not found once suspended', async () => {
    const before = await app.inject({ method: 'GET', url: `/api/channels/${slug}` })
    expect(before.statusCode).toBe(200)

    await prisma.user.update({
      where: { username: slug },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
    const after = await app.inject({ method: 'GET', url: `/api/channels/${slug}` })
    expect(after.statusCode).toBe(404)
  })
})
