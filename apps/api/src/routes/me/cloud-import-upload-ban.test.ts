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

const PREFIX = 'cloud-import-ban-'

describe('An upload ban covers SoundCloud and Google Drive imports', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let userId: string
  let cookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
    })
    userId = artist.id
    cookie = await sessionCookieFor(prisma, artist.id)
    await prisma.accountRestriction.create({
      data: { userId, type: 'UPLOAD', reason: 'Copyright strikes' },
    })
  })

  afterAll(async () => {
    await prisma.cloudImportJob.deleteMany({ where: { userId } })
    await prisma.accountRestriction.deleteMany({ where: { userId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('refuses a SoundCloud import', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/soundcloud/import',
      headers: { cookie },
      payload: { tracks: [{ trackId: '1', title: 'Track' }] },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('Uploads is blocked: Copyright strikes')
  })

  it('refuses a Google Drive import', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/google-drive/import',
      headers: { cookie },
      payload: { files: [{ fileId: 'f1', name: 'mix.wav' }] },
    })
    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('Uploads is blocked: Copyright strikes')
    expect(await prisma.cloudImportJob.count({ where: { userId } })).toBe(0)
  })
})
