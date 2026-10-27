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

const PREFIX = 'export-addons-access-'

describe('GET /api/me/data-export.json — add-ons, devices and API tokens', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.addon.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: `${PREFIX}user`,
    })
    cookie = await sessionCookieFor(prisma, user.id)
    const addon = await prisma.addon.create({
      data: {
        slug: `${PREFIX}lyrics`,
        scope: 'LISTENER',
        name: 'Lyrics',
        description: 'Shows lyrics',
        authorName: 'User',
        authorUserId: user.id,
        currentVersion: '1.0.0',
        bundleKey: 'addons/lyrics.js',
        bundleHash: 'abc',
        bundleSizeBytes: 10,
      },
    })
    await prisma.addonInstall.create({ data: { widgetId: addon.id, listenerUserId: user.id } })
    await prisma.apiToken.create({
      data: { userId: user.id, name: 'CLI', tokenHash: `${PREFIX}hash`, tokenPrefix: 'tht_abc' },
    })
  })

  afterAll(async () => {
    await prisma.addon.deleteMany({ where: { slug: { startsWith: PREFIX } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('lists add-ons, installs, devices and tokens without secrets', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/data-export.json',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.addonsPublished).toEqual([
      expect.objectContaining({ slug: `${PREFIX}lyrics`, name: 'Lyrics', status: 'DRAFT' }),
    ])
    expect(body.addonInstalls).toEqual([
      expect.objectContaining({
        enabled: true,
        widget: { slug: `${PREFIX}lyrics`, name: 'Lyrics' },
      }),
    ])
    expect(body.devices.length).toBeGreaterThanOrEqual(1)
    expect(body.apiTokens).toEqual([
      expect.objectContaining({ name: 'CLI', tokenPrefix: 'tht_abc' }),
    ])
    expect(JSON.stringify(body)).not.toContain(`${PREFIX}hash`)
  })
})
