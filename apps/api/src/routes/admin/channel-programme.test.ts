// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-programme-test-'

describe("admin channel programme — board edits any artist's rotation", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistCookie: string
  let channelSlug: string
  let channelId: string
  let itemA: string
  let itemB: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'admin-programme-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98620,
    })
    channelSlug = artist.channel!.slug
    channelId = artist.channel!.id
    artistCookie = await sessionCookieFor(prisma, artist.id)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-programme-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98621,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const a = await createReadyArchiveItem(prisma, channelId, 'Board Set A')
    const b = await createReadyArchiveItem(prisma, channelId, 'Board Set B')
    itemA = a.id
    itemB = b.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects a non-board session', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/admin/channels/${channelSlug}/programme`,
      headers: { cookie: artistCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('rejects an unknown channel slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/channels/does-not-exist-xyz/programme',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it("lets a board member view and edit another artist's rotation", async () => {
    const view = await app.inject({
      method: 'GET',
      url: `/api/admin/channels/${channelSlug}/programme`,
      headers: { cookie: boardCookie },
    })
    expect(view.statusCode).toBe(200)
    expect(view.json().items.length).toBeGreaterThanOrEqual(2)
    // Preview URL resolved for the editor's play button — not just raw keys.
    const items = view.json().items as Array<{ id: string; audioUrl: string | null }>
    expect(items.every((i) => i.audioUrl)).toBe(true)

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/channels/${channelSlug}/programme`,
      headers: { cookie: boardCookie },
      payload: {
        fallbackMode: 'ordered',
        items: [
          { archiveItemId: itemA, isFallback: true, fallbackOrder: 0 },
          { archiveItemId: itemB, isFallback: true, fallbackOrder: 1 },
        ],
      },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().fallbackMode).toBe('ordered')

    const updated = await prisma.archiveItem.findUnique({ where: { id: itemA } })
    expect(updated?.isFallback).toBe(true)
    expect(updated?.fallbackOrder).toBe(0)
  })

  it('rejects an archive item that belongs to a different channel', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'admin-programme-other',
      tier: 'FREE',
    })
    const foreignItem = await createReadyArchiveItem(prisma, other.channel!.id, 'Foreign Set')

    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/channels/${channelSlug}/programme`,
      headers: { cookie: boardCookie },
      payload: { items: [{ archiveItemId: foreignItem.id, isFallback: true }] },
    })
    expect(res.statusCode).toBe(400)

    await prisma.user.delete({ where: { id: other.id } })
  })
})
