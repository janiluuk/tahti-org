// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@tahti/db'
import { TAHTI_RADIO_SLUG } from '@tahti/shared'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'radio-rtmp-scope-'
const BASE = '/api/admin/radio/rtmp-targets'

describe('Radio destinations for board add-ons', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistCookie: string
  let radioId: string
  let artistTargetId: string
  let radioTargetId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
    })
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    const radio = await prisma.channel.findUnique({ where: { slug: TAHTI_RADIO_SLUG } })
    if (radio) radioId = radio.id
    else {
      const owner = await createTestArtist(prisma, {
        email: `${PREFIX}radio@example.com`,
        username: TAHTI_RADIO_SLUG,
      })
      radioId = owner.channel!.id
    }
    boardCookie = await sessionCookieFor(prisma, board.id)
    artistCookie = await sessionCookieFor(prisma, artist.id)
    const own = await app.inject({
      method: 'POST',
      url: '/api/me/rtmp-targets',
      headers: { cookie: boardCookie },
      payload: {
        provider: 'MIXCLOUD_LIVE',
        label: 'Own stream',
        streamKey: 'own-key',
        enabled: false,
      },
    })
    expect(own.statusCode).toBe(201)
    artistTargetId = own.json().id
  })

  afterAll(async () => {
    if (radioTargetId) await prisma.rtmpTarget.deleteMany({ where: { id: radioTargetId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects anonymous and non-board access to every destination operation', async () => {
    for (const route of [
      { method: 'GET' as const, url: BASE },
      { method: 'POST' as const, url: BASE },
      { method: 'PATCH' as const, url: `${BASE}/${artistTargetId}` },
      { method: 'DELETE' as const, url: `${BASE}/${artistTargetId}` },
      { method: 'POST' as const, url: `${BASE}/${artistTargetId}/test` },
      { method: 'GET' as const, url: `${BASE}/${artistTargetId}/stream-key` },
    ]) {
      expect((await app.inject(route)).statusCode).toBe(401)
      expect((await app.inject({ ...route, headers: { cookie: artistCookie } })).statusCode).toBe(
        403,
      )
    }
  })

  it('isolates radio destinations from the board member own channel', async () => {
    const created = await app.inject({
      method: 'POST',
      url: BASE,
      headers: { cookie: boardCookie },
      payload: {
        provider: 'MIXCLOUD_LIVE',
        label: 'Radio Mixcloud',
        streamKey: 'radio-secret',
        enabled: false,
        alwaysMirror: true,
      },
    })
    expect(created.statusCode).toBe(201)
    radioTargetId = created.json().id
    expect(created.json()).toMatchObject({ enabled: false, alwaysMirror: true })
    const saved = await prisma.rtmpTarget.findUniqueOrThrow({ where: { id: radioTargetId } })
    expect(saved.channelId).toBe(radioId)
    expect(saved.streamKeyEnc).not.toContain('radio-secret')
    const list = await app.inject({ method: 'GET', url: BASE, headers: { cookie: boardCookie } })
    expect(list.json().some((target: { id: string }) => target.id === radioTargetId)).toBe(true)
    expect(list.json().some((target: { id: string }) => target.id === artistTargetId)).toBe(false)
    expect(list.body).not.toContain('radio-secret')
    for (const [base, id] of [
      [BASE, artistTargetId],
      ['/api/me/rtmp-targets', radioTargetId],
    ]) {
      const reveal = await app.inject({
        method: 'GET',
        url: `${base}/${id}/stream-key`,
        headers: { cookie: boardCookie },
      })
      expect(reveal.statusCode).toBe(404)
      const remove = await app.inject({
        method: 'DELETE',
        url: `${base}/${id}`,
        headers: { cookie: boardCookie },
      })
      expect(remove.statusCode).toBe(404)
    }
    const patched = await app.inject({
      method: 'PATCH',
      url: `${BASE}/${radioTargetId}`,
      headers: { cookie: boardCookie },
      payload: { label: 'Radio updated', enabled: false },
    })
    expect(patched.statusCode).toBe(200)
    const removed = await app.inject({
      method: 'DELETE',
      url: `${BASE}/${radioTargetId}`,
      headers: { cookie: boardCookie },
    })
    expect(removed.statusCode).toBe(204)
  })
})
