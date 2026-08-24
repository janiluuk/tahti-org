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

const PREFIX = 'integrations-test-'

describe('me/integrations', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'integrations-test-artist',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98382,
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await prisma.integrationCredential.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/me/integrations' })
    expect(res.statusCode).toBe(401)
  })

  it('lists every registry provider as not installed/connected initially', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/me/integrations',
      headers: { cookie },
    })
    expect(res.statusCode).toBe(200)
    const { integrations } = res.json() as { integrations: Array<{ slug: string }> }
    expect(integrations.map((i) => i.slug)).toEqual(
      expect.arrayContaining(['spotify', 'hearthis-import', 'soundcloud', 'acoustid']),
    )
    expect(
      integrations.every(
        (i: { installed: boolean; connected: boolean }) => !i.installed && !i.connected,
      ),
    ).toBe(true)
  })

  it('404s installing an unknown slug', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/integrations/not-a-real-provider/install',
      headers: { cookie },
      payload: { fields: {} },
    })
    expect(res.statusCode).toBe(404)
  })

  it('rejects installing an OAuth-kind provider via the key-entry endpoint', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/integrations/soundcloud/install',
      headers: { cookie },
      payload: { fields: {} },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects an install missing a required field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/integrations/spotify/install',
      headers: { cookie },
      payload: { fields: { clientId: 'abc' } },
    })
    expect(res.statusCode).toBe(400)
  })

  it('rejects an install with an unknown field', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/integrations/hearthis-import/install',
      headers: { cookie },
      payload: { fields: { apiKey: 'unexpected' } },
    })
    expect(res.statusCode).toBe(400)
  })

  it('installs a no-field provider, lists it as installed, then removes it', async () => {
    const install = await app.inject({
      method: 'POST',
      url: '/api/me/integrations/hearthis-import/install',
      headers: { cookie },
      payload: { fields: {} },
    })
    expect(install.statusCode).toBe(204)

    const list = await app.inject({
      method: 'GET',
      url: '/api/me/integrations',
      headers: { cookie },
    })
    const { integrations } = list.json() as {
      integrations: Array<{ slug: string; installed: boolean }>
    }
    expect(integrations.find((i) => i.slug === 'hearthis-import')?.installed).toBe(true)

    const del = await app.inject({
      method: 'DELETE',
      url: '/api/me/integrations/hearthis-import',
      headers: { cookie },
    })
    expect(del.statusCode).toBe(204)

    const listAfter = await app.inject({
      method: 'GET',
      url: '/api/me/integrations',
      headers: { cookie },
    })
    const { integrations: after } = listAfter.json() as {
      integrations: Array<{ slug: string; installed: boolean }>
    }
    expect(after.find((i) => i.slug === 'hearthis-import')?.installed).toBe(false)
  })

  it('installs spotify with credentials and encrypts them at rest', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/integrations/spotify/install',
      headers: { cookie },
      payload: { fields: { clientId: 'client-abc', clientSecret: 'secret-xyz' } },
    })
    expect(res.statusCode).toBe(204)

    const row = await prisma.integrationCredential.findUnique({
      where: { userId_providerSlug: { userId, providerSlug: 'spotify' } },
    })
    expect(row).not.toBeNull()
    expect(row?.fieldsEnc).not.toContain('secret-xyz')
  })
})
