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
  let defaultWidgetId: string
  let quietChannelSlug: string
  let quietChannelId: string

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

    const quietArtist = await createTestArtist(prisma, {
      email: `${PREFIX}quiet@example.com`,
      username: `${PREFIX}quiet`,
    })
    quietChannelSlug = quietArtist.channel!.slug
    quietChannelId = quietArtist.channel!.id

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

    const defaultWidget = await prisma.addon.create({
      data: {
        slug: `${PREFIX}on-by-default`,
        scope: 'ARTIST',
        name: 'Test on-by-default',
        description: 'Coverage fixture for enabledByDefault',
        authorName: 'Tahti tests',
        categories: ['utility'],
        currentVersion: '1.0.0',
        bundleKey: 'widgets/test-default.js',
        bundleHash: 'def456hash',
        bundleSizeBytes: 128,
        status: 'APPROVED',
        enabledByDefault: true,
      },
    })
    defaultWidgetId = defaultWidget.id
  })

  afterAll(async () => {
    await prisma.addonInstall.deleteMany({
      where: { widgetId: { in: [widgetId, defaultWidgetId] } },
    })
    await prisma.addon.deleteMany({ where: { id: { in: [widgetId, defaultWidgetId] } } })
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

  it('enabledByDefault renders for a channel with no install row of its own', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/channels/${quietChannelSlug}/addons`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      widgets: Array<{ widgetSlug: string; installId: string }>
    }
    const rendered = body.widgets.find((w) => w.widgetSlug === `${PREFIX}on-by-default`)
    expect(rendered).toBeDefined()
    expect(rendered?.installId).toBe(`default:${defaultWidgetId}`)
  })

  it('a disabled install row suppresses an enabledByDefault widget', async () => {
    const suppression = await prisma.addonInstall.create({
      data: {
        widgetId: defaultWidgetId,
        channelId: quietChannelId,
        position: 0,
        enabled: false,
      },
    })
    try {
      const res = await app.inject({
        method: 'GET',
        url: `/api/v1/channels/${quietChannelSlug}/addons`,
      })
      expect(res.statusCode).toBe(200)
      const body = res.json() as { widgets: Array<{ widgetSlug: string }> }
      expect(body.widgets.some((w) => w.widgetSlug === `${PREFIX}on-by-default`)).toBe(false)
    } finally {
      await prisma.addonInstall.delete({ where: { id: suppression.id } })
    }
  })
})
