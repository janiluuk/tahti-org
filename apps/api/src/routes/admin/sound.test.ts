// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-sound-'

describe("admin sound edit — board access to any channel's tracks", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistCookie: string
  let channelSlug: string
  let soundId: string
  let artistUserId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-sound-board',
    })
    await prisma.user.update({ where: { id: board.id }, data: { isBoard: true, isMember: true } })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'admin-sound-artist',
    })
    artistUserId = artist.id
    artistCookie = await sessionCookieFor(prisma, artist.id)
    channelSlug = artist.channel!.slug

    const item = await createReadySound(prisma, artist.channel!.id, 'Original title')
    soundId = item.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects a non-board artist', async () => {
    const list = await app.inject({
      method: 'GET',
      url: `/api/admin/channels/${channelSlug}/sound`,
      headers: { cookie: artistCookie },
    })
    expect(list.statusCode).toBe(403)
  })

  it("lists a channel's sound items for a board member", async () => {
    const list = await app.inject({
      method: 'GET',
      url: `/api/admin/channels/${channelSlug}/sound`,
      headers: { cookie: boardCookie },
    })
    expect(list.statusCode).toBe(200)
    const row = list.json().find((i: { id: string }) => i.id === soundId)
    expect(row).toBeTruthy()
    expect(row.title).toBe('Original title')
  })

  it('patches metadata for a track the board member does not own', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/channels/${channelSlug}/sound/${soundId}`,
      headers: { cookie: boardCookie },
      // Matches exactly what the admin editor form submits — including an empty
      // description, which must be sent as '' not null (the shared schema field
      // is optional but not nullable).
      payload: {
        title: 'Moderated title',
        genre: 'Techno',
        contentType: 'DJ_SET',
        license: 'ALL_RIGHTS_RESERVED',
        description: '',
        isPublic: false,
      },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json().title).toBe('Moderated title')
    expect(patch.json().genre).toBe('Techno')
    expect(patch.json().isPublic).toBe(false)

    const audit = await prisma.auditLog.findFirst({
      where: { action: 'SOUND_METADATA_ADMIN_EDIT', targetId: soundId },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit).toBeTruthy()
    expect(audit?.actorId).not.toBe(artistUserId)
  })

  it('404s for an item that does not belong to the given channel slug', async () => {
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'admin-sound-other',
    })
    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/admin/channels/${other.channel!.slug}/sound/${soundId}`,
      headers: { cookie: boardCookie },
      payload: { title: 'Should not apply' },
    })
    expect(patch.statusCode).toBe(404)
  })
})
