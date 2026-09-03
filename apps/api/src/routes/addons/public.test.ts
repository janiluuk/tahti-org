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

const PREFIX = 'addon-public-'

describe('addons store + public render feeds', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let channelSlug: string
  let widgetId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    cookie = await sessionCookieFor(prisma, artist.id)
    channelSlug = artist.channel!.slug

    const widget = await prisma.addon.create({
      data: {
        slug: `${PREFIX}clock`,
        scope: 'ARTIST',
        name: 'Test clock',
        description: 'Coverage fixture',
        authorName: 'Tahti tests',
        categories: ['utility'],
        currentVersion: '1.0.0',
        bundleKey: 'widgets/test-clock.js',
        bundleHash: 'abc123hash',
        bundleSizeBytes: 128,
        status: 'APPROVED',
      },
    })
    widgetId = widget.id

    await prisma.addonInstall.create({
      data: {
        widgetId,
        channelId: artist.channel!.id,
        position: 0,
        enabled: true,
      },
    })
  })

  afterAll(async () => {
    await prisma.addonInstall.deleteMany({ where: { widgetId } })
    await prisma.addon.deleteMany({ where: { id: widgetId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET /api/addons/store requires auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/addons/store?scope=ARTIST',
    })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/addons/store lists APPROVED ARTIST widgets for artists', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/addons/store?scope=ARTIST',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { widgets: Array<{ id: string; slug: string }> }
    expect(body.widgets.some((w) => w.id === widgetId && w.slug === `${PREFIX}clock`)).toBe(true)
  })

  it('GET /api/v1/channels/:slug/addons is public and returns installs', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/channels/${channelSlug}/addons`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      widgets: Array<{ widgetSlug: string; sandboxUrl: string }>
    }
    expect(body.widgets.some((w) => w.widgetSlug === `${PREFIX}clock`)).toBe(true)
    expect(body.widgets[0]?.sandboxUrl).toContain('/widget-sandbox/')
  })

  it('GET /api/v1/channels/:slug/addons 404s for unknown slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/channels/no-such-channel-zzzz/addons',
    })
    expect(res.statusCode).toBe(404)
  })
})
