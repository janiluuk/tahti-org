// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'listen-events-test-'

describe('/api/listen-events', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let eligibleItemId: string
  let ineligibleItemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Listen Test Owner',
    })

    const eligible = await prisma.archiveItem.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Eligible Track',
        status: 'READY',
        isPublic: true,
      },
    })
    eligibleItemId = eligible.id

    const ineligible = await prisma.archiveItem.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Ineligible Track',
        status: 'READY',
        isPublic: true,
        topListsEligible: false,
      },
    })
    ineligibleItemId = ineligible.id
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('records a listen for an anonymous request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/listen-events',
      payload: { archiveItemId: eligibleItemId },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ recorded: true })

    const count = await prisma.listenEvent.count({ where: { archiveItemId: eligibleItemId } })
    expect(count).toBe(1)
  })

  it('dedupes a second listen from the same listener on the same day', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/listen-events',
      payload: { archiveItemId: eligibleItemId },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ recorded: false })

    const count = await prisma.listenEvent.count({ where: { archiveItemId: eligibleItemId } })
    expect(count).toBe(1)
  })

  it('does not record a listen for a topListsEligible: false track', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/listen-events',
      payload: { archiveItemId: ineligibleItemId },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ recorded: false })

    const count = await prisma.listenEvent.count({ where: { archiveItemId: ineligibleItemId } })
    expect(count).toBe(0)
  })

  it('does not record a listen for an unknown track, and does not error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/listen-events',
      payload: { archiveItemId: 'does-not-exist' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ recorded: false })
  })

  it('rejects a missing archiveItemId', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/listen-events', payload: {} })
    expect(res.statusCode).toBe(400)
  })
})
