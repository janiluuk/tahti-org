// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'dir-susp-'

describe('the artist directory and suspended artists', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    for (const name of ['kept', 'suspended']) {
      const artist = await createTestArtist(prisma, {
        email: `${PREFIX}${name}@example.com`,
        username: `${PREFIX}${name}`,
      })
      const sound = await createReadySound(prisma, artist.channel!.id, `${name} track`)
      await prisma.sound.update({ where: { id: sound.id }, data: { isPublic: true } })
    }
    await prisma.user.update({
      where: { username: `${PREFIX}suspended` },
      data: { suspendedAt: new Date(), suspendReason: 'test' },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists the artist in good standing and not the suspended one', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/channels/directory' })
    expect(res.statusCode).toBe(200)
    const body = JSON.stringify(res.json())
    expect(body).toContain(`${PREFIX}kept`)
    expect(body).not.toContain(`${PREFIX}suspended`)
  })
})
