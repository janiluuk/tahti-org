// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'download-share-test-'
const SLUG = 'download-share-test-artist'

describe('sound downloads through share links', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let privateId: string
  let gatedId: string
  let ipCounter = 0

  async function download(soundId: string, key?: string) {
    ipCounter += 1
    const query = new URLSearchParams({ fp: `${PREFIX}${ipCounter}` })
    if (key) query.set('key', key)
    return app.inject({
      method: 'GET',
      url: `/api/v1/c/${SLUG}/sounds/${soundId}/download?${query.toString()}`,
      headers: { 'x-forwarded-for': `203.0.113.${100 + ipCounter}` },
    })
  }

  async function share(soundId: string, token: string, data: Record<string, unknown> = {}) {
    await prisma.soundShare.create({ data: { soundId, token: `${PREFIX}${token}`, ...data } })
    return `${PREFIX}${token}`
  }

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: SLUG,
    })
    const channelId = artist.channel!.id
    const base = {
      channelId,
      rawKey: `raw/${PREFIX}.wav`,
      mp3Key: `mp3/${PREFIX}.mp3`,
      fileSizeBytes: BigInt(1_000_000),
      status: 'READY' as const,
      isPublic: false,
    }
    privateId = (await prisma.sound.create({ data: { ...base, title: 'Private mix' } })).id
    gatedId = (
      await prisma.sound.create({
        data: { ...base, title: 'Private gated mix', followToDownload: true },
      })
    ).id
  })

  afterAll(async () => {
    await prisma.download.deleteMany({ where: { soundId: { in: [privateId, gatedId] } } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('refuses a private sound without a key', async () => {
    expect((await download(privateId)).statusCode).toBe(404)
  })

  it('lets a DOWNLOAD share key download a private sound', async () => {
    const key = await share(privateId, 'download', { permission: 'DOWNLOAD' })
    const res = await download(privateId, key)
    expect(res.statusCode).toBe(200)
    expect(res.json().url).toEqual(expect.any(String))
  })

  it('refuses a READ share key', async () => {
    const key = await share(privateId, 'read', { permission: 'READ' })
    expect((await download(privateId, key)).statusCode).toBe(404)
  })

  it('refuses an expired DOWNLOAD share key', async () => {
    const key = await share(privateId, 'expired', {
      permission: 'DOWNLOAD',
      expiresAt: new Date(Date.now() - 60_000),
    })
    expect((await download(privateId, key)).statusCode).toBe(404)
  })

  it('refuses a DOWNLOAD key made for another sound', async () => {
    const key = await share(gatedId, 'other-sound', { permission: 'DOWNLOAD' })
    expect((await download(privateId, key)).statusCode).toBe(404)
  })

  it('refuses a DOWNLOAD key granted to someone else when signed out', async () => {
    const key = await share(privateId, 'grantee', {
      permission: 'DOWNLOAD',
      granteeUsername: 'someone-else',
    })
    expect((await download(privateId, key)).statusCode).toBe(404)
  })

  it('still applies the follow gate to a shared private sound', async () => {
    const key = await share(gatedId, 'gated', { permission: 'DOWNLOAD' })
    const res = await download(gatedId, key)
    expect(res.statusCode).toBe(403)
    expect(res.json().gates).toEqual(['follow'])
  })
})
