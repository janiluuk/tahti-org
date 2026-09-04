// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma, upsertUserIntegrationCredential } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'listen-events-test-'

describe('/api/listen-events', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let eligibleItemId: string
  let ineligibleItemId: string
  let ownerChannelId: string
  let listenerId: string
  let listenerCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Listen Test Owner',
    })
    ownerChannelId = owner.channel!.id

    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: `${PREFIX}listener`,
      displayName: 'Listen Test Listener',
    })
    listenerId = listener.id
    listenerCookie = await sessionCookieFor(prisma, listener.id)

    const eligible = await prisma.sound.create({
      data: {
        channelId: ownerChannelId,
        title: 'Eligible Track',
        status: 'READY',
        isPublic: true,
      },
    })
    eligibleItemId = eligible.id

    const ineligible = await prisma.sound.create({
      data: {
        channelId: ownerChannelId,
        title: 'Ineligible Track',
        status: 'READY',
        isPublic: true,
        topListsEligible: false,
      },
    })
    ineligibleItemId = ineligible.id
  })

  afterAll(async () => {
    await prisma.integrationCredential.deleteMany({ where: { userId: listenerId } })
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('records a listen for an anonymous request', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/listen-events',
      payload: { soundId: eligibleItemId },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ recorded: true })

    const count = await prisma.listenEvent.count({ where: { soundId: eligibleItemId } })
    expect(count).toBe(1)
  })

  it('dedupes a second listen from the same listener on the same day', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/listen-events',
      payload: { soundId: eligibleItemId },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ recorded: false })

    const count = await prisma.listenEvent.count({ where: { soundId: eligibleItemId } })
    expect(count).toBe(1)
  })

  it('does not record a listen for a topListsEligible: false track', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/listen-events',
      payload: { soundId: ineligibleItemId },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ recorded: false })

    const count = await prisma.listenEvent.count({ where: { soundId: ineligibleItemId } })
    expect(count).toBe(0)
  })

  it('does not record a listen for an unknown track, and does not error', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/listen-events',
      payload: { soundId: 'does-not-exist' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ recorded: false })
  })

  it('rejects a missing soundId', async () => {
    const res = await app.inject({ method: 'POST', url: '/api/listen-events', payload: {} })
    expect(res.statusCode).toBe(400)
  })

  it('scrobbles to ListenBrainz when credential is present and recorded is true', async () => {
    const scrobbleSound = await prisma.sound.create({
      data: {
        channelId: ownerChannelId,
        title: 'Scrobble Track',
        status: 'READY',
        isPublic: true,
      },
    })

    await upsertUserIntegrationCredential(prisma, listenerId, 'listenbrainz', {
      userToken: 'lb-test-token',
    })

    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 'ok' }), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    const res = await app.inject({
      method: 'POST',
      url: '/api/listen-events',
      headers: { cookie: listenerCookie },
      payload: { soundId: scrobbleSound.id },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ recorded: true })

    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.listenbrainz.org/1/submit-listens',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({ Authorization: 'Token lb-test-token' }),
      }),
    )
    const init = fetchMock.mock.calls[0]?.[1] as RequestInit
    const body = JSON.parse(String(init.body)) as {
      listen_type: string
      payload: Array<{ track_metadata: { artist_name: string; track_name: string } }>
    }
    expect(body.listen_type).toBe('single')
    expect(body.payload[0]?.track_metadata).toMatchObject({
      artist_name: 'Listen Test Owner',
      track_name: 'Scrobble Track',
    })

    await prisma.integrationCredential.deleteMany({
      where: { userId: listenerId, providerSlug: 'listenbrainz' },
    })
    await prisma.listenEvent.deleteMany({ where: { soundId: scrobbleSound.id } })
    await prisma.sound.delete({ where: { id: scrobbleSound.id } })
  })
})
