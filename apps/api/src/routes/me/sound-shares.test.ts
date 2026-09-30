// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  allocateMemberNumber,
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'sound-shares-test-'

describe('sound share links', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string
  let soundId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'sound-shares-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'sound-shares-other',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    otherCookie = await sessionCookieFor(prisma, other.id)
    const sound = await createReadySound(prisma, artist.channel!.id, 'Unreleased demo')
    await prisma.sound.update({ where: { id: sound.id }, data: { isPublic: false } })
    soundId = sound.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('mints, lists and revokes a link', async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/share`,
      headers: { cookie },
      payload: { granteeUsername: '@Sound-Shares-Other', permission: 'DOWNLOAD', expiresInDays: 7 },
    })
    expect(create.statusCode).toBe(201)
    const share = create.json()
    expect(share).toMatchObject({ granteeUsername: 'sound-shares-other', permission: 'DOWNLOAD' })
    expect(share.token).toHaveLength(32)
    expect(new Date(share.expiresAt).getTime()).toBeGreaterThan(Date.now() + 6 * 86_400_000)

    const list = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/shares`,
      headers: { cookie },
    })
    expect(list.json().shares.map((s: { id: string }) => s.id)).toEqual([share.id])

    const revoke = await app.inject({
      method: 'DELETE',
      url: `/api/me/sound/shares/${share.id}`,
      headers: { cookie },
    })
    expect(revoke.statusCode).toBe(204)
    expect(await prisma.soundShare.count({ where: { soundId } })).toBe(0)
  })

  it('leaves expired links out of the list', async () => {
    await prisma.soundShare.create({
      data: {
        soundId,
        token: 'expired-token-sound-shares-test',
        expiresAt: new Date(Date.now() - 1000),
      },
    })
    const list = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/shares`,
      headers: { cookie },
    })
    expect(list.json().shares).toEqual([])
    await prisma.soundShare.deleteMany({ where: { soundId } })
  })

  it('rejects an unknown grantee and a bad permission', async () => {
    const unknown = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/share`,
      headers: { cookie },
      payload: { granteeUsername: 'nobody-here-xyz', permission: 'READ' },
    })
    expect(unknown.statusCode).toBe(404)
    const bad = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/share`,
      headers: { cookie },
      payload: { permission: 'WRITE' },
    })
    expect(bad.statusCode).toBe(400)
  })

  it("keeps other artists away from a sound's links", async () => {
    const create = await app.inject({
      method: 'POST',
      url: `/api/me/sound/${soundId}/share`,
      headers: { cookie },
      payload: {},
    })
    const shareId = create.json().id
    const list = await app.inject({
      method: 'GET',
      url: `/api/me/sound/${soundId}/shares`,
      headers: { cookie: otherCookie },
    })
    expect(list.statusCode).toBe(404)
    const revoke = await app.inject({
      method: 'DELETE',
      url: `/api/me/sound/shares/${shareId}`,
      headers: { cookie: otherCookie },
    })
    expect(revoke.statusCode).toBe(404)
  })
})
