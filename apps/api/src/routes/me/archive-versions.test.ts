// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma, ensureInitialVersion, syncActiveVersionToItem } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'archive-version-test-'

describe('M28 — archive item version history', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let archiveItemId: string
  let channelSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'archive-version-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98520,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    channelSlug = artist.channel!.slug
    const item = await createReadyArchiveItem(prisma, artist.channel!.id, 'Versioned track')
    archiveItemId = item.id
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('backfills version 1 on GET /api/me/archive/:id/versions', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/versions`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const versions = res.json() as Array<{ versionNumber: number; isActive: boolean }>
    expect(versions).toHaveLength(1)
    expect(versions[0].versionNumber).toBe(1)
    expect(versions[0].isActive).toBe(true)
  })

  it('creates a pending version on complete and lists it', async () => {
    const rawKey = `raw/${channelSlug}/test-version.wav`
    const complete = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/versions/complete`,
      headers: { cookie },
      payload: { uploadId: rawKey, versionLabel: 'Re-edit 2026' },
    })
    expect(complete.statusCode).toBe(201)
    expect(complete.json().versionLabel).toBe('Re-edit 2026')

    const list = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/versions`,
      headers: { cookie },
    })
    expect(list.json()).toHaveLength(2)
  })

  it('GET /api/me/archive/:id/versions/:versionId returns one version', async () => {
    const v2 = await prisma.archiveItemVersion.findFirst({
      where: { archiveItemId, versionLabel: 'Re-edit 2026' },
    })
    expect(v2).toBeTruthy()

    const res = await app.inject({
      method: 'GET',
      url: `/api/me/archive/${archiveItemId}/versions/${v2!.id}`,
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { versionLabel: string; versionNumber: number }
    expect(body.versionLabel).toBe('Re-edit 2026')
    expect(body.versionNumber).toBe(2)
  })

  it('activates a ready version and syncs audio keys to the parent item', async () => {
    const v2 = await prisma.archiveItemVersion.findFirst({
      where: { archiveItemId, versionLabel: 'Re-edit 2026' },
    })
    expect(v2).toBeTruthy()

    await prisma.archiveItemVersion.update({
      where: { id: v2!.id },
      data: {
        status: 'READY',
        mp3Key: 'mp3/test/reedit.mp3',
        durationSec: 3600,
      },
    })

    const activate = await app.inject({
      method: 'POST',
      url: `/api/me/archive/${archiveItemId}/versions/${v2!.id}/activate`,
      headers: { cookie },
    })
    expect(activate.statusCode).toBe(200)
    const active = activate.json().find((v: { isActive: boolean }) => v.isActive)
    expect(active.versionLabel).toBe('Re-edit 2026')

    const item = await prisma.archiveItem.findUnique({ where: { id: archiveItemId } })
    expect(item?.mp3Key).toBe('mp3/test/reedit.mp3')
    expect(item?.durationSec).toBe(3600)
  })

  it('ensureInitialVersion is idempotent', async () => {
    await ensureInitialVersion(prisma, archiveItemId)
    const count = await prisma.archiveItemVersion.count({ where: { archiveItemId } })
    expect(count).toBe(2)
  })

  it('syncActiveVersionToItem copies active version keys', async () => {
    await syncActiveVersionToItem(prisma, archiveItemId)
    const item = await prisma.archiveItem.findUnique({ where: { id: archiveItemId } })
    expect(item?.mp3Key).toBe('mp3/test/reedit.mp3')
  })
})
