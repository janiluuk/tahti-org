// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { TAHTI_SELECTS_SLUG } from '@tahti/shared'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
} from '../../test/helpers.js'

const PREFIX = 'selects-private-'

describe('Tahti Selects drops tracks the artist withdrew', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const selects = await createTestArtist(prisma, {
      email: `${PREFIX}selects@example.com`,
      username: TAHTI_SELECTS_SLUG,
    })
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'selects-private-artist',
    })
    const kept = await createReadySound(prisma, artist.channel!.id, 'Still selected')
    const withdrawn = await createReadySound(prisma, artist.channel!.id, 'Withdrawn by artist')
    await prisma.sound.update({ where: { id: withdrawn.id }, data: { isPublic: false } })
    await prisma.curatedRotationItem.createMany({
      data: [
        { channelId: selects.channel!.id, soundId: kept.id, position: 1, addedById: selects.id },
        {
          channelId: selects.channel!.id,
          soundId: withdrawn.id,
          position: 2,
          addedById: selects.id,
        },
      ],
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('leaves a private track out of the gallery', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/tahti-selects/gallery' })
    expect(res.statusCode).toBe(200)
    expect(res.json().items.map((i: { title: string }) => i.title)).toEqual(['Still selected'])
  })

  it('leaves a private track out of the rotation and the upcoming list', async () => {
    const rotation = await app.inject({ method: 'GET', url: '/api/v1/radio/rotation' })
    expect(rotation.body).not.toContain('Withdrawn by artist')
    const upcoming = await app.inject({
      method: 'GET',
      url: `/api/v1/radio/show/${TAHTI_SELECTS_SLUG}/upcoming`,
    })
    expect(upcoming.body).toContain('Still selected')
    expect(upcoming.body).not.toContain('Withdrawn by artist')
  })
})
