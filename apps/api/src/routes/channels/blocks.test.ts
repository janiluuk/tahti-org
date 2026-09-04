// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'channel-blocks-public-'

describe('GET /api/v1/channels/:slug/blocks', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelSlug: string
  let channelId: string
  let widgetId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    channelSlug = artist.channel!.slug
    channelId = artist.channel!.id

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
  })

  afterAll(async () => {
    await prisma.channelBlock.deleteMany({ where: { channelId } })
    await prisma.addonInstall.deleteMany({ where: { widgetId } })
    await prisma.addon.deleteMany({ where: { id: widgetId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('404s for an unknown channel', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/channels/does-not-exist/blocks' })
    expect(res.statusCode).toBe(404)
  })

  it('returns an empty list for a channel with no blocks', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/channels/${channelSlug}/blocks`,
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ blocks: [] })
  })

  it('resolves a LOGO block, an ADDON block, and drops blocks with nothing to render, in position order', async () => {
    const install = await prisma.addonInstall.create({
      data: { widgetId, channelId, position: 0, enabled: true },
    })

    await prisma.channelBlock.create({
      data: {
        channelId,
        type: 'ADDON',
        width: 'HALF',
        position: 0,
        configJson: { addonInstallId: install.id },
      },
    })
    await prisma.channelBlock.create({
      data: {
        channelId,
        type: 'LOGO',
        width: 'FULL',
        position: 1,
        configJson: { assetUrl: 'https://example.com/logo.png' },
      },
    })
    // No assetUrl at all -- should be dropped, not sent broken.
    await prisma.channelBlock.create({
      data: { channelId, type: 'LOGO', width: 'THIRD', position: 2, configJson: {} },
    })
    // References an install that doesn't exist -- should be dropped too.
    await prisma.channelBlock.create({
      data: {
        channelId,
        type: 'ADDON',
        width: 'THIRD',
        position: 3,
        configJson: { addonInstallId: 'does-not-exist' },
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/channels/${channelSlug}/blocks`,
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      blocks: Array<{
        type: string
        width: string
        position: number
        assetUrl?: string
        addon?: { name: string; sandboxUrl: string }
      }>
    }
    expect(body.blocks).toHaveLength(2)
    expect(body.blocks[0]).toMatchObject({ type: 'ADDON', width: 'HALF', position: 0 })
    expect(body.blocks[0]!.addon).toMatchObject({ name: 'Test clock' })
    expect(body.blocks[0]!.addon!.sandboxUrl).toContain('abc123hash')
    expect(body.blocks[1]).toMatchObject({
      type: 'LOGO',
      width: 'FULL',
      position: 1,
      assetUrl: 'https://example.com/logo.png',
    })
  })

  it('drops an ADDON block whose install has since been disabled', async () => {
    const install = await prisma.addonInstall.update({
      where: { widgetId_channelId: { widgetId, channelId } },
      data: { enabled: false },
    })
    const block = await prisma.channelBlock.create({
      data: {
        channelId,
        type: 'ADDON',
        width: 'FULL',
        position: 10,
        configJson: { addonInstallId: install.id },
      },
    })

    const res = await app.inject({
      method: 'GET',
      url: `/api/v1/channels/${channelSlug}/blocks`,
    })
    const body = res.json() as { blocks: Array<{ id: string }> }
    expect(body.blocks.some((b) => b.id === block.id)).toBe(false)
  })
})
