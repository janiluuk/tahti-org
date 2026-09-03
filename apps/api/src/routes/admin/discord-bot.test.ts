// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { encryptStreamKey } from '../../lib/stream-key-enc.js'
import { DISCORD_BOT_SETTINGS_ID } from '../../lib/discord-bot-settings.js'
import {
  createTestArtist,
  sessionCookieFor,
  cleanupUsersByEmailPrefix,
  allocateMemberNumber,
} from '../../test/helpers.js'

const PREFIX = 'admin-discord-bot-'
const CLIENT_ID = '1168742859038531594'
const TOKEN = 'test-discord-bot-token-f4eb'

describe('admin discord-bot settings', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let artistCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: 'admin-discord-bot-artist',
    })
    artistCookie = await sessionCookieFor(prisma, artist.id)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'admin-discord-bot-board',
      isBoard: true,
      isMember: true,
      memberNumber: await allocateMemberNumber(prisma),
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  beforeEach(async () => {
    await prisma.discordBotSettings.deleteMany()
  })

  afterAll(async () => {
    await prisma.discordBotSettings.deleteMany()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects non-board users', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/discord-bot',
      headers: { cookie: artistCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('returns empty settings when nothing is configured', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/admin/discord-bot',
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      clientId: '',
      tokenConfigured: false,
      tokenHint: null,
      source: 'none',
    })
  })

  it('requires a token on first save', async () => {
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/discord-bot',
      headers: { cookie: boardCookie },
      payload: { clientId: CLIENT_ID },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({
      error: 'Bot token is required the first time these settings are saved',
    })
  })

  it('saves credentials and never returns the raw token', async () => {
    const put = await app.inject({
      method: 'PUT',
      url: '/api/admin/discord-bot',
      headers: { cookie: boardCookie },
      payload: { clientId: CLIENT_ID, token: TOKEN },
    })
    expect(put.statusCode).toBe(200)
    const body = put.json() as {
      clientId: string
      tokenConfigured: boolean
      tokenHint: string
      source: string
      token?: string
    }
    expect(body.clientId).toBe(CLIENT_ID)
    expect(body.tokenConfigured).toBe(true)
    expect(body.tokenHint).toBe('••••f4eb')
    expect(body.source).toBe('database')
    expect(body.token).toBeUndefined()
    expect(JSON.stringify(body)).not.toContain(TOKEN)

    const get = await app.inject({
      method: 'GET',
      url: '/api/admin/discord-bot',
      headers: { cookie: boardCookie },
    })
    expect(get.json()).toMatchObject({
      clientId: CLIENT_ID,
      tokenConfigured: true,
      tokenHint: '••••f4eb',
      source: 'database',
    })
    expect(JSON.stringify(get.json())).not.toContain(TOKEN)
  })

  it('keeps the existing token when PUT omits it', async () => {
    await prisma.discordBotSettings.create({
      data: {
        id: DISCORD_BOT_SETTINGS_ID,
        clientId: CLIENT_ID,
        tokenEnc: encryptStreamKey(TOKEN),
      },
    })

    const nextId = '1168742859038531595'
    const res = await app.inject({
      method: 'PUT',
      url: '/api/admin/discord-bot',
      headers: { cookie: boardCookie },
      payload: { clientId: nextId },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({
      clientId: nextId,
      tokenConfigured: true,
      tokenHint: '••••f4eb',
    })
  })
})
