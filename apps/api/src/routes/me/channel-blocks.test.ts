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

const PREFIX = 'channel-blocks-'

describe('channel designer blocks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let otherCookie: string
  let channelSlug: string
  let widgetId: string
  let installId: string

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

    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    otherCookie = await sessionCookieFor(prisma, other.id)

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
        bundleHash: 'abc123hashblocks',
        bundleSizeBytes: 128,
        status: 'APPROVED',
      },
    })
    widgetId = widget.id
    const install = await prisma.addonInstall.create({
      data: {
        widgetId,
        channelId: artist.channel!.id,
        position: 0,
        enabled: true,
      },
    })
    installId = install.id
  })

  afterAll(async () => {
    await prisma.channelBlock.deleteMany({
      where: { channel: { user: { email: { startsWith: PREFIX } } } },
    })
    await prisma.addonInstall.deleteMany({ where: { widgetId } })
    await prisma.addon.deleteMany({ where: { id: widgetId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('GET requires an artist session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/channel/blocks' })
    expect(res.statusCode).toBe(401)
  })

  it('creates LOGO and ADDON blocks, lists them in order, and exposes a public feed', async () => {
    const logo = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: {
        type: 'LOGO',
        width: 'HALF',
        configJson: {
          assetId: 'media/channel-blocks-artist/logo.png',
          url: 'https://cdn.example/media/channel-blocks-artist/logo.png',
        },
      },
    })
    expect(logo.statusCode).toBe(201)
    const logoBody = logo.json() as { id: string; type: string; width: string }
    expect(logoBody.type).toBe('LOGO')
    expect(logoBody.width).toBe('HALF')

    const addon = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: {
        type: 'ADDON',
        width: 'HALF',
        configJson: { addonInstallId: installId },
      },
    })
    expect(addon.statusCode).toBe(201)
    const addonBody = addon.json() as { id: string }

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/channel/blocks',
      headers: { cookie },
    })
    expect(list.statusCode).toBe(200)
    const listed = list.json() as { blocks: Array<{ id: string; type: string }> }
    expect(listed.blocks.map((b) => b.type)).toEqual(['LOGO', 'ADDON'])

    const duplicate = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: {
        type: 'ADDON',
        configJson: { addonInstallId: installId },
      },
    })
    expect(duplicate.statusCode).toBe(409)

    const publicFeed = await app.inject({
      method: 'GET',
      url: `/api/v1/channels/${channelSlug}/blocks`,
    })
    expect(publicFeed.statusCode).toBe(200)
    const feed = publicFeed.json() as {
      blocks: Array<{ type: string; logoUrl: string | null; addon: { installId: string } | null }>
    }
    expect(feed.blocks).toHaveLength(2)
    expect(feed.blocks[0]?.logoUrl).toContain('logo.png')
    expect(feed.blocks[1]?.addon?.installId).toBe(installId)

    const reorder = await app.inject({
      method: 'PUT',
      url: '/api/me/channel/blocks/reorder',
      headers: { cookie },
      payload: { ids: [addonBody.id, logoBody.id] },
    })
    expect(reorder.statusCode).toBe(204)

    const patched = await app.inject({
      method: 'PATCH',
      url: `/api/me/channel/blocks/${logoBody.id}`,
      headers: { cookie },
      payload: { width: 'FULL' },
    })
    expect(patched.statusCode).toBe(200)
    expect((patched.json() as { width: string }).width).toBe('FULL')

    const foreign = await app.inject({
      method: 'PATCH',
      url: `/api/me/channel/blocks/${logoBody.id}`,
      headers: { cookie: otherCookie },
      payload: { width: 'THIRD' },
    })
    expect(foreign.statusCode).toBe(404)

    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/me/channel/blocks/${addonBody.id}`,
      headers: { cookie },
    })
    expect(removed.statusCode).toBe(204)

    const afterDelete = await app.inject({
      method: 'GET',
      url: '/api/me/channel/blocks',
      headers: { cookie },
    })
    const remaining = afterDelete.json() as { blocks: Array<{ id: string }> }
    expect(remaining.blocks.map((b) => b.id)).toEqual([logoBody.id])
  })

  it('rejects unknown addon installs and invalid logo payloads', async () => {
    const missingInstall = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: {
        type: 'ADDON',
        configJson: { addonInstallId: 'does-not-exist' },
      },
    })
    expect(missingInstall.statusCode).toBe(404)

    const badLogo = await app.inject({
      method: 'POST',
      url: '/api/me/channel/blocks',
      headers: { cookie },
      payload: {
        type: 'LOGO',
        configJson: { assetId: 'x', url: 'javascript:alert(1)' },
      },
    })
    expect(badLogo.statusCode).toBe(400)
  })

  it('public feed 404s for unknown slug', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/channels/no-such-channel-zzzz/blocks',
    })
    expect(res.statusCode).toBe(404)
  })
})
