// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'top-lists-settings-test-'

describe('/api/me/top-lists-opt-out', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string
  let channelId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      displayName: 'Top Lists Settings Owner',
    })
    userId = owner.id
    channelId = owner.channel!.id
    cookie = await sessionCookieFor(prisma, owner.id)
  })

  afterAll(async () => {
    await app.close()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/top-lists-opt-out' })
    expect(res.statusCode).toBe(401)
  })

  it('defaults to opted in (topListsOptOut: false)', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/top-lists-opt-out',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ topListsOptOut: false })
  })

  it('patches the default and seeds new uploads from it', async () => {
    const patch = await app.inject({
      method: 'PATCH',
      url: '/api/me/top-lists-opt-out',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { topListsOptOut: true },
    })
    expect(patch.statusCode).toBe(200)
    expect(patch.json()).toEqual({ topListsOptOut: true })

    const item = await prisma.archiveItem.create({
      data: { channelId, title: 'New Upload', status: 'READY', isPublic: true },
    })
    // topListsEligible defaults to true at the Prisma level (this test creates
    // directly, bypassing the upload route) — the seed-from-default wiring is
    // covered by asserting the upload route itself sets it, not this fixture.
    expect(item.topListsEligible).toBe(true)

    // restore for suite hygiene
    await app.inject({
      method: 'PATCH',
      url: '/api/me/top-lists-opt-out',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { topListsOptOut: false },
    })
  })

  it('lets the track owner flip topListsEligible per-track via the metadata patch', async () => {
    const item = await prisma.archiveItem.create({
      data: { channelId, title: 'Override Track', status: 'READY', isPublic: true },
    })

    const patch = await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${item.id}`,
      headers: { cookie, 'content-type': 'application/json' },
      payload: { topListsEligible: false },
    })
    expect(patch.statusCode).toBe(200)

    const updated = await prisma.archiveItem.findUniqueOrThrow({ where: { id: item.id } })
    expect(updated.topListsEligible).toBe(false)
  })

  it('seeds topListsEligible: false on upload when the account default is opted out', async () => {
    await prisma.user.update({ where: { id: userId }, data: { topListsOptOut: true } })

    const prepare = await app.inject({
      method: 'POST',
      url: '/api/uploads/prepare',
      headers: { cookie, 'content-type': 'application/json' },
      payload: {
        filename: 'opt-out-seed-test.mp3',
        contentType: 'audio/mpeg',
        fileSizeBytes: 1024,
        title: 'Opt Out Seed Test',
      },
    })
    expect(prepare.statusCode).toBe(200)
    const { uploadId } = prepare.json() as { uploadId: string }

    const complete = await app.inject({
      method: 'POST',
      url: '/api/uploads/complete',
      headers: { cookie, 'content-type': 'application/json' },
      payload: { uploadId, etag: 'test-etag', title: 'Opt Out Seed Test' },
    })
    expect(complete.statusCode).toBe(201)

    const created = await prisma.archiveItem.findUniqueOrThrow({
      where: { id: complete.json().itemId },
      select: { topListsEligible: true },
    })
    expect(created.topListsEligible).toBe(false)

    await prisma.user.update({ where: { id: userId }, data: { topListsOptOut: false } })
  })
})
