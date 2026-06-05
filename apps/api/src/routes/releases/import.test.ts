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

const PREFIX = 'rel-import-'

describe('M12 — release bulk import', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie: string
  let userId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'rel-import-artist',
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('POST /api/me/releases/import creates draft releases', async () => {
    const csv = `releaseTitle,type,releaseDate,trackTitle
Import One,SINGLE,2026-05-01,Track A
Import Two,EP,2026-05-15,Part 1
Import Two,EP,2026-05-15,Part 2`

    const res = await app.inject({
      method: 'POST',
      url: '/api/me/releases/import',
      headers: { cookie },
      payload: { csv },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as { created: number; releaseIds: string[] }
    expect(body.created).toBe(2)

    const count = await prisma.release.count({ where: { userId, state: 'DRAFT' } })
    expect(count).toBeGreaterThanOrEqual(2)
  })

  it('rejects CSV missing required columns', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/releases/import',
      headers: { cookie },
      payload: { csv: 'title,date\nOnly Title,2026-01-01' },
    })
    expect(res.statusCode).toBe(400)
  })
})
