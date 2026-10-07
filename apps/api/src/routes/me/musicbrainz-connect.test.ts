// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, afterEach, vi } from 'vitest'
import { MusicbrainzConnectStatusSchema, MusicbrainzDefaultSchema } from '@tahti/shared'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'
import { config } from '../../config.js'

const PREFIX = 'musicbrainz-connect-'
const STATE = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'

describe('MusicBrainz connection', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string
  const original = { ...config.musicbrainz }

  function setCredentials(clientId: string, clientSecret: string) {
    config.musicbrainz.clientId = clientId
    config.musicbrainz.clientSecret = clientSecret
  }

  /** MusicBrainz answering the token exchange and the userinfo lookup. */
  function stubMusicbrainz() {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: string | URL | Request) =>
        String(input).includes('/oauth2/token')
          ? Response.json({ access_token: 'mb-access', refresh_token: 'mb-refresh' })
          : Response.json({ sub: 'mb-editor' }),
      ),
    )
  }

  const callback = (headers: Record<string, string>) =>
    app.inject({
      method: 'GET',
      url: `/api/me/musicbrainz/oauth/callback?code=abc&state=${STATE}`,
      headers,
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const user = await createTestArtist(prisma, {
      email: `${PREFIX}user@example.com`,
      username: 'musicbrainz-connect-user',
    })
    userId = user.id
    cookie = await sessionCookieFor(prisma, user.id)
  })

  afterEach(async () => {
    vi.unstubAllGlobals()
    setCredentials(original.clientId, original.clientSecret)
    await prisma.user.update({
      where: { id: userId },
      data: { musicbrainzAccessTokenEnc: null, musicbrainzUsername: null },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('reports configured only when the server has both the client id and the secret', async () => {
    setCredentials('client-id', 'client-secret')
    const both = await app.inject({
      method: 'GET',
      url: '/api/me/musicbrainz',
      headers: { cookie },
    })
    expect(MusicbrainzConnectStatusSchema.parse(both.json())).toEqual({
      connected: false,
      configured: true,
      username: null,
    })

    setCredentials('client-id', '')
    const idOnly = await app.inject({
      method: 'GET',
      url: '/api/me/musicbrainz',
      headers: { cookie },
    })
    expect(idOnly.json().configured).toBe(false)
    const start = await app.inject({
      method: 'GET',
      url: '/api/me/musicbrainz/oauth/start',
      headers: { cookie },
    })
    expect(start.statusCode).toBe(503)
  })

  it('the callback links the account and status then names the editor', async () => {
    setCredentials('client-id', 'client-secret')
    stubMusicbrainz()
    const res = await callback({
      cookie: `${cookie}; ${config.musicbrainz.oauthStateCookie}=${STATE}`,
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('?mb=connected')

    const status = await app.inject({
      method: 'GET',
      url: '/api/me/musicbrainz',
      headers: { cookie },
    })
    expect(status.json()).toEqual({ connected: true, configured: true, username: 'mb-editor' })
  })

  it('the callback does not link a deleted account whose session cookie is still around', async () => {
    setCredentials('client-id', 'client-secret')
    stubMusicbrainz()
    // Its own account: deleting it ends that account's session for good.
    const leaving = await createTestArtist(prisma, {
      email: `${PREFIX}leaving@example.com`,
      username: 'musicbrainz-connect-leaving',
    })
    const leavingCookie = await sessionCookieFor(prisma, leaving.id)
    await prisma.user.update({ where: { id: leaving.id }, data: { deletedAt: new Date() } })

    const res = await callback({
      cookie: `${leavingCookie}; ${config.musicbrainz.oauthStateCookie}=${STATE}`,
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('?mb=login')
    const row = await prisma.user.findUniqueOrThrow({
      where: { id: leaving.id },
      select: { musicbrainzAccessTokenEnc: true },
    })
    expect(row.musicbrainzAccessTokenEnc).toBeNull()
  })

  it('the old callback path still answers', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/musicbrainz/oauth/callback?code=abc&state=nope',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(302)
    expect(res.headers.location).toContain('?mb=error')
  })

  it('remembers the register-on-MusicBrainz choice', async () => {
    const initial = await app.inject({
      method: 'GET',
      url: '/api/me/musicbrainz/default',
      headers: { cookie },
    })
    expect(MusicbrainzDefaultSchema.parse(initial.json())).toEqual({
      defaultRegisterToMusicbrainz: null,
    })

    const saved = await app.inject({
      method: 'PATCH',
      url: '/api/me/musicbrainz/default',
      headers: { cookie },
      payload: { defaultRegisterToMusicbrainz: true },
    })
    expect(saved.json()).toEqual({ defaultRegisterToMusicbrainz: true })

    const cleared = await app.inject({
      method: 'PATCH',
      url: '/api/me/musicbrainz/default',
      headers: { cookie },
      payload: { defaultRegisterToMusicbrainz: null },
    })
    expect(cleared.json()).toEqual({ defaultRegisterToMusicbrainz: null })
  })
})
