// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import {
  cleanupUsersByEmailPrefix,
  createTahtiRadioChannel,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'journey-tahti-radio-'

describe('Tahti Radio journey', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let radioUserId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    const radio = await createTahtiRadioChannel(prisma)
    radioUserId = radio.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await cleanupUsersByEmailPrefix(prisma, 'tahti-radio@')
    await app.close()
  })

  it('listener opens radio channel page APIs without auth', async () => {
    const channel = await app.inject({
      method: 'GET',
      url: `/api/channels/${TAHTI_RADIO_SLUG}`,
    })
    expect(channel.statusCode).toBe(200)
    expect(channel.json().state).toBe('LIVE')
    expect(channel.json().slug).toBe(TAHTI_RADIO_SLUG)

    const access = await app.inject({
      method: 'GET',
      url: `/api/chat/${TAHTI_RADIO_SLUG}/access`,
    })
    expect(access.statusCode).toBe(200)
    expect(typeof access.json().fanChatEnabled).toBe('boolean')

    const viewer = await app.inject({
      method: 'POST',
      url: `/api/chat/${TAHTI_RADIO_SLUG}/viewer-token`,
    })
    expect(viewer.statusCode).toBe(200)
    expect(typeof viewer.json().token).toBe('string')
    expect(viewer.json().token.length).toBeGreaterThan(10)

    const announcements = await app.inject({
      method: 'GET',
      url: `/api/chat/${TAHTI_RADIO_SLUG}/announcements`,
    })
    expect(announcements.statusCode).toBe(200)
    expect(Array.isArray(announcements.json())).toBe(true)
  })

  it('artist posts announcement → listener sees it on radio chat', async () => {
    const cookie = await sessionCookieFor(prisma, radioUserId)

    const post = await app.inject({
      method: 'POST',
      url: '/api/me/chat/announcements',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { body: 'Now playing: community mix' },
    })
    expect(post.statusCode).toBe(201)

    const list = await app.inject({
      method: 'GET',
      url: `/api/chat/${TAHTI_RADIO_SLUG}/announcements`,
    })
    expect(list.statusCode).toBe(200)
    expect(list.json().some((a: { body: string }) => a.body.includes('community mix'))).toBe(true)
  })

  it('radio now-playing proxy returns offline when service is down', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/radio' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toHaveProperty('live')
  })

  it('eligible for member relay when another artist is live', async () => {
    const relay = await createTestArtist(prisma, {
      email: `${PREFIX}relay@example.com`,
      username: `${PREFIX}relay`,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98402,
    })
    await prisma.channel.update({
      where: { id: relay.channel!.id },
      data: { state: 'LIVE', metaStreamOptOut: false },
    })

    const internal = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/radio/current-live',
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(internal.statusCode).toBe(200)
    const slugs = (internal.json() as Array<{ slug: string }>).map((c) => c.slug)
    expect(slugs).toContain(`${PREFIX}relay`)
  })
})
