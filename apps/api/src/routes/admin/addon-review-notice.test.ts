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

const PREFIX = 'addon-review-notice-'

describe("An add-on's author is told the board's decision", () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let authorId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.addon.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
    const author = await createTestArtist(prisma, {
      email: `${PREFIX}author@example.com`,
      username: `${PREFIX}author`,
    })
    authorId = author.id
  })

  afterAll(async () => {
    await prisma.addon.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const pending = (name: string) =>
    prisma.addon.create({
      data: {
        slug: `${PREFIX}${name.toLowerCase()}`,
        scope: 'LISTENER',
        name,
        description: 'A widget',
        authorName: 'Author',
        authorUserId: authorId,
        currentVersion: '1.0.0',
        bundleKey: `addons/${PREFIX}${name}.js`,
        bundleHash: 'abc',
        bundleSizeBytes: 10,
        status: 'PENDING',
      },
    })

  const review = (id: string, action: string, payload: object = {}) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/addons/${id}/${action}`,
      headers: { cookie: boardCookie },
      payload,
    })

  it('notifies on approve, reject and disable', async () => {
    const lyrics = await pending('Lyrics')
    expect((await review(lyrics.id, 'approve')).statusCode).toBe(200)
    const clock = await pending('Clock')
    expect(
      (await review(clock.id, 'reject', { moderationNote: 'Reads the clipboard' })).statusCode,
    ).toBe(200)
    expect(
      (await review(lyrics.id, 'disable', { moderationNote: 'Broke playback' })).statusCode,
    ).toBe(200)

    const notices = await prisma.notification.findMany({
      where: { userId: authorId, type: 'ADDON_REVIEWED' },
      orderBy: { createdAt: 'asc' },
    })
    expect(notices.map((n) => [n.title, n.body])).toEqual([
      ['Lyrics was approved and is in the add-on store', null],
      ['Clock was not approved', 'Reads the clipboard'],
      ['The board disabled Lyrics', 'Broke playback'],
    ])
  })
})
