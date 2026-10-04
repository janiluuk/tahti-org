// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'radio-suggestions-'

describe('radio station suggestions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let listenerCookie: string
  let boardCookie: string
  let listenerId: string

  const suggest = (payload: Record<string, unknown>, cookie = listenerCookie) =>
    app.inject({
      method: 'POST',
      url: '/api/me/radio-station-suggestions',
      headers: { cookie },
      payload,
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: 'radio-suggestions-listener',
      displayName: 'Radio Fan',
    })
    listenerId = listener.id
    listenerCookie = await sessionCookieFor(prisma, listener.id)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'radio-suggestions-board',
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await prisma.radioStationSuggestion.deleteMany({ where: { submitterId: listenerId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('stores a suggestion and lists it for the board', async () => {
    const res = await suggest({
      name: 'Basso FM',
      logoUrl: null,
      language: 'Finnish',
      bitrateKbps: 128,
      streamUrl: 'https://stream.example.fi/radio-suggestions-basso.mp3',
    })
    expect(res.statusCode).toBe(201)
    expect(res.json()).toMatchObject({ status: 'PENDING' })

    const list = await app.inject({
      method: 'GET',
      url: '/api/admin/radio-station-suggestions?status=PENDING',
      headers: { cookie: boardCookie },
    })
    expect(list.statusCode).toBe(200)
    const item = (list.json() as { items: Array<Record<string, unknown>> }).items.find(
      (row) => row.streamUrl === 'https://stream.example.fi/radio-suggestions-basso.mp3',
    )
    expect(item).toMatchObject({
      name: 'Basso FM',
      language: 'Finnish',
      bitrateKbps: 128,
      submitter: { username: 'radio-suggestions-listener', displayName: 'Radio Fan' },
    })
  })

  it('refuses a duplicate stream, bad input and anonymous callers', async () => {
    const duplicate = await suggest({
      name: 'Basso again',
      language: 'Finnish',
      streamUrl: 'https://stream.example.fi/radio-suggestions-basso.mp3',
    })
    expect(duplicate.statusCode).toBe(409)
    const bad = await suggest({ name: 'x', language: 'Finnish', streamUrl: 'ftp://nope' })
    expect(bad.statusCode).toBe(400)
    const anonymous = await app.inject({
      method: 'POST',
      url: '/api/me/radio-station-suggestions',
      payload: { name: 'x', language: 'y', streamUrl: 'https://z.example/a' },
    })
    expect(anonymous.statusCode).toBe(401)
  })

  it('caps pending suggestions per listener', async () => {
    for (let i = 0; i < 4; i++) {
      const res = await suggest({
        name: `Station ${i}`,
        language: 'English',
        streamUrl: `https://stream.example.fi/radio-suggestions-${i}.mp3`,
      })
      expect(res.statusCode).toBe(201)
    }
    const over = await suggest({
      name: 'One too many',
      language: 'English',
      streamUrl: 'https://stream.example.fi/radio-suggestions-extra.mp3',
    })
    expect(over.statusCode).toBe(429)
  })

  it('keeps the board list board-only', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/radio-station-suggestions',
      headers: { cookie: listenerCookie },
    })
    expect(res.statusCode).toBe(403)
  })
})
