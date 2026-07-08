// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * E2E journey: artist uploads ALBUM (5 tracks) + EP + SINGLE with distinct color
 * schemes, keeps the album in draft/stash, and shares album masters via stash to a fan.
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

vi.mock('../../lib/minio.js', () => ({
  presignedPutUrl: vi.fn().mockResolvedValue('https://minio.test/stash-put'),
  presignedGetUrl: vi.fn().mockResolvedValue('https://minio.test/stash-get'),
  s3: { send: vi.fn().mockResolvedValue({}) },
}))

const PREFIX = 'journey-relcat-'

const SCHEMES = {
  ALBUM: {
    bg: '#0a1628',
    accent: '#00d4aa',
    text: '#e8f4f0',
    muted: '#4a6670',
    highlight: '#66e3c4',
  },
  EP: {
    bg: '#1a0a28',
    accent: '#a855f7',
    text: '#f3e8ff',
    muted: '#6b5080',
    highlight: '#c084fc',
  },
  SINGLE: {
    bg: '#1c1408',
    accent: '#f59e0b',
    text: '#fef3c7',
    muted: '#78716c',
    highlight: '#fbbf24',
  },
} as const

function trackTitles(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix} Track ${i + 1}`)
}

async function createReleaseWithTracks(
  app: Awaited<ReturnType<typeof buildApp>>,
  cookie: string,
  opts: {
    title: string
    type: 'ALBUM' | 'EP' | 'SINGLE'
    trackTitles: string[]
  },
) {
  const res = await app.inject({
    method: 'POST',
    url: '/api/me/releases',
    headers: { cookie },
    payload: {
      title: opts.title,
      type: opts.type,
      releaseDate: '2026-06-01',
      tracks: opts.trackTitles.map((title) => ({ title })),
    },
  })
  expect(res.statusCode).toBe(201)
  return res.json() as { id: string; smartLinkSlug: string; type: string; tracks: { id: string }[] }
}

describe('Release catalog journey (album + EP + single)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('uploads album (5 tracks), EP, and single with distinct color schemes; album stays draft/stash with fan stash share', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'journey-relcat-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98120,
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: 'journey-relcat-fan',
      tier: 'FREE',
    })

    const artistCookie = await sessionCookieFor(prisma, artist.id)

    const album = await createReleaseWithTracks(app, artistCookie, {
      title: 'Catalog Album Five',
      type: 'ALBUM',
      trackTitles: trackTitles('Album', 5),
    })
    expect(album.tracks).toHaveLength(5)

    const ep = await createReleaseWithTracks(app, artistCookie, {
      title: 'Catalog EP Three',
      type: 'EP',
      trackTitles: trackTitles('EP', 3),
    })
    expect(ep.tracks).toHaveLength(3)

    const single = await createReleaseWithTracks(app, artistCookie, {
      title: 'Catalog Single One',
      type: 'SINGLE',
      trackTitles: trackTitles('Single', 1),
    })
    expect(single.tracks).toHaveLength(1)

    for (const [release, scheme, preset] of [
      [album, SCHEMES.ALBUM, 'AURORA'] as const,
      [ep, SCHEMES.EP, 'PARTICLE_FIELD'] as const,
      [single, SCHEMES.SINGLE, 'REACTIVE_GRID'] as const,
    ]) {
      const visual = await app.inject({
        method: 'PATCH',
        url: `/api/me/releases/${release.id}/visual`,
        headers: { cookie: artistCookie },
        payload: { visualPreset: preset, colorScheme: scheme },
      })
      expect(visual.statusCode).toBe(200)
      const parsed = JSON.parse(visual.json().colorSchemeJson as string) as { accent: string }
      expect(parsed.accent).toBe(scheme.accent)
    }

    const pubEp = await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${ep.id}`,
      headers: { cookie: artistCookie },
      payload: { state: 'PUBLISHED' },
    })
    expect(pubEp.statusCode).toBe(200)

    const pubSingle = await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${single.id}`,
      headers: { cookie: artistCookie },
      payload: { state: 'PUBLISHED' },
    })
    expect(pubSingle.statusCode).toBe(200)

    // Album stays DRAFT — private catalog / stash (not on profile or smart link)
    const albumRow = await prisma.release.findUnique({ where: { id: album.id } })
    expect(albumRow?.state).toBe('DRAFT')

    const draftSmart = await app.inject({
      method: 'GET',
      url: `/api/v1/r/${album.smartLinkSlug}`,
    })
    expect(draftSmart.statusCode).toBe(404)

    const epSmart = await app.inject({ method: 'GET', url: `/api/v1/r/${ep.smartLinkSlug}` })
    expect(epSmart.statusCode).toBe(200)
    expect(epSmart.json().release.colorScheme.accent).toBe(SCHEMES.EP.accent)

    const singleSmart = await app.inject({
      method: 'GET',
      url: `/api/v1/r/${single.smartLinkSlug}`,
    })
    expect(singleSmart.statusCode).toBe(200)
    expect(singleSmart.json().release.colorScheme.accent).toBe(SCHEMES.SINGLE.accent)

    const profile = await app.inject({
      method: 'GET',
      url: `/api/v1/u/${artist.username}/profile`,
    })
    expect(profile.statusCode).toBe(200)
    const profileTitles = (profile.json().releases as { title: string }[]).map((r) => r.title)
    expect(profileTitles).toContain('Catalog EP Three')
    expect(profileTitles).toContain('Catalog Single One')
    expect(profileTitles).not.toContain('Catalog Album Five')

    // Private collection (stash vault) holds the album release — publish briefly to attach, then return to draft
    const pubAlbum = await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${album.id}`,
      headers: { cookie: artistCookie },
      payload: { state: 'PUBLISHED' },
    })
    expect(pubAlbum.statusCode).toBe(200)

    const vaultSlug = `${artist.username}-album-stash`
    const colCreate = await app.inject({
      method: 'POST',
      url: '/api/me/collections',
      headers: { cookie: artistCookie },
      payload: { name: 'Album stash vault', slug: vaultSlug, isPublic: false },
    })
    expect(colCreate.statusCode).toBe(201)

    const addItem = await app.inject({
      method: 'POST',
      url: `/api/me/collections/${vaultSlug}/items`,
      headers: { cookie: artistCookie },
      payload: { releaseId: album.id },
    })
    expect(addItem.statusCode).toBe(201)

    const backToDraft = await app.inject({
      method: 'PATCH',
      url: `/api/me/releases/${album.id}`,
      headers: { cookie: artistCookie },
      payload: { state: 'DRAFT' },
    })
    expect(backToDraft.statusCode).toBe(200)
    expect(backToDraft.json().state).toBe('DRAFT')

    const publicCol = await app.inject({
      method: 'GET',
      url: `/api/v1/collections/${vaultSlug}`,
    })
    expect(publicCol.statusCode).toBe(404)

    // Stash: album masters shared to fan username (fans-only delivery path)
    const stashRegister = await app.inject({
      method: 'POST',
      url: '/api/me/stash',
      headers: { cookie: artistCookie },
      payload: {
        filename: 'catalog-album-masters.zip',
        objectKey: `stash/${artist.id}/e2e-album-masters.zip`,
        contentType: 'application/zip',
        sizeBytes: 12_000_000,
        format: 'ZIP',
      },
    })
    expect(stashRegister.statusCode).toBe(201)
    const stashFileId = stashRegister.json().id as string

    const share = await app.inject({
      method: 'POST',
      url: `/api/me/stash/${stashFileId}/share`,
      headers: { cookie: artistCookie },
      payload: { granteeUsername: fan.username, permission: 'READ', expiresInDays: 30 },
    })
    expect(share.statusCode).toBe(201)
    expect(share.json().token).toBeTruthy()

    const stashList = await app.inject({
      method: 'GET',
      url: '/api/me/stash',
      headers: { cookie: artistCookie },
    })
    expect(stashList.statusCode).toBe(200)
    const stashFiles = stashList.json().files as Array<{
      filename: string
      shares: Array<{ granteeUsername: string | null }>
    }>
    const masters = stashFiles.find((f) => f.filename === 'catalog-album-masters.zip')
    expect(masters?.shares.some((s) => s.granteeUsername === fan.username)).toBe(true)

    const meReleases = await app.inject({
      method: 'GET',
      url: '/api/me/releases',
      headers: { cookie: artistCookie },
    })
    expect(meReleases.statusCode).toBe(200)
    const listed = meReleases.json().releases as Array<{
      title: string
      type: string
      state: string
      colorSchemeJson: string | null
    }>
    const byTitle = Object.fromEntries(listed.map((r) => [r.title, r]))

    expect(byTitle['Catalog Album Five']?.state).toBe('DRAFT')
    expect(JSON.parse(byTitle['Catalog Album Five']!.colorSchemeJson!).accent).toBe(
      SCHEMES.ALBUM.accent,
    )
    expect(byTitle['Catalog EP Three']?.type).toBe('EP')
    expect(JSON.parse(byTitle['Catalog EP Three']!.colorSchemeJson!).accent).toBe(SCHEMES.EP.accent)
    expect(byTitle['Catalog Single One']?.type).toBe('SINGLE')
    expect(JSON.parse(byTitle['Catalog Single One']!.colorSchemeJson!).accent).toBe(
      SCHEMES.SINGLE.accent,
    )
  })
})
