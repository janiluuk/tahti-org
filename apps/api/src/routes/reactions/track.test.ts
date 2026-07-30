// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'track-reactions-test-'

describe('/api/reactions/track/:id', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let otherCookie: string
  let channelSlug: string
  let archiveItemId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Reaction Test Owner',
    })
    channelSlug = owner.channel!.slug
    ownerCookie = await sessionCookieFor(prisma, owner.id)

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
      displayName: 'Reaction Test Other',
    })
    otherCookie = await sessionCookieFor(prisma, other.id)

    const item = await prisma.archiveItem.create({
      data: {
        channelId: owner.channel!.id,
        title: 'Reaction Test Track',
        status: 'READY',
        isPublic: true,
        durationSec: 180,
        peaks: [10, 20, 255, 0],
        tracklist: [{ startSec: 0, title: 'Cue one', artist: 'Guest' }],
      },
    })
    archiveItemId = item.id
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('returns peaks, identity, and tracklist alongside an empty reaction list', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/reactions/track/${archiveItemId}` })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.peaks).toEqual([10, 20, 255, 0])
    expect(body.title).toBe('Reaction Test Track')
    expect(body.artistName).toBe('Reaction Test Owner')
    expect(body.channelSlug).toBe(channelSlug)
    expect(body.tracklist).toEqual([{ startSec: 0, title: 'Cue one', artist: 'Guest' }])
    expect(body.reactions).toEqual([])
  })

  it('404s for an unknown track', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/reactions/track/does-not-exist' })
    expect(res.statusCode).toBe(404)
  })

  it('requires auth to post a reaction', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/reactions/track/${archiveItemId}`,
      payload: { type: 'LAUGH', positionSec: 12 },
    })
    expect(res.statusCode).toBe(401)
  })

  it('posts a non-LOVE reaction without publishing to chat', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))

    const res = await app.inject({
      method: 'POST',
      url: `/api/reactions/track/${archiveItemId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { type: 'HANDS_UP', positionSec: 42 },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ type: 'HANDS_UP', positionSec: 42 })
    expect(fetchSpy).not.toHaveBeenCalled()

    const list = await app.inject({ method: 'GET', url: `/api/reactions/track/${archiveItemId}` })
    expect(list.json().reactions).toHaveLength(1)
    expect(list.json().reactions[0]).toMatchObject({ type: 'HANDS_UP', positionSec: 42 })
  })

  it('clamps positionSec to the track duration', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/reactions/track/${archiveItemId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { type: 'SURPRISE', positionSec: 500 },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().positionSec).toBe(180)
  })

  it('rejects an invalid reaction type', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/reactions/track/${archiveItemId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { type: 'ANGRY', positionSec: 1 },
    })
    expect(res.statusCode).toBe(400)
  })

  it('posting LOVE publishes a "loved" system message to the channel chat', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))

    const res = await app.inject({
      method: 'POST',
      url: `/api/reactions/track/${archiveItemId}`,
      headers: { cookie: otherCookie, 'content-type': 'application/json' },
      payload: { type: 'LOVE', positionSec: 5 },
    })
    expect(res.statusCode).toBe(201)
    expect(res.json().type).toBe('LOVE')

    // fire-and-forget publish — give the microtask queue a tick
    await new Promise((r) => setTimeout(r, 0))
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    const [, init] = fetchSpy.mock.calls[0]!
    const body = JSON.parse(init!.body as string)
    expect(body.params.channel).toBe(`channel:${channelSlug}`)
    expect(body.params.data.text).toBe('Reaction Test Other loved Reaction Test Track')
    expect(body.params.data.href).toBe(
      `http://localhost:3000/c/${channelSlug}#archive-item-${archiveItemId}`,
    )
    expect(body.params.data.system).toBe(true)
  })

  it('rate-limits after 20 reactions from the same user within the window', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue(new Response('{}'))
    // owner has posted 0 so far in this suite — burn through the 20/min budget
    let last
    for (let i = 0; i < 21; i++) {
      last = await app.inject({
        method: 'POST',
        url: `/api/reactions/track/${archiveItemId}`,
        headers: { cookie: ownerCookie, 'content-type': 'application/json' },
        payload: { type: 'LAUGH', positionSec: i },
      })
    }
    expect(last!.statusCode).toBe(429)
  })
})
