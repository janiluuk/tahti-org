// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { config } from '../../config.js'
import { encryptStreamKey } from '../../lib/stream-key-enc.js'
import { DISCORD_BOT_SETTINGS_ID } from '../../lib/discord-bot-settings.js'

const CLIENT_ID = '1168742859038531594'
const TOKEN = 'test-discord-bot-token-f4eb'

describe('internal discord-bot credentials', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.discordBotSettings.deleteMany()
    await prisma.discordBotSettings.create({
      data: {
        id: DISCORD_BOT_SETTINGS_ID,
        clientId: CLIENT_ID,
        tokenEnc: encryptStreamKey(TOKEN),
      },
    })
  })

  afterAll(async () => {
    await prisma.discordBotSettings.deleteMany()
    await app.close()
  })

  it('rejects missing internal auth', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/discord-bot/credentials',
    })
    expect(res.statusCode).toBe(401)
  })

  it('returns plaintext credentials to the bot process', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/internal/discord-bot/credentials',
      headers: { authorization: `Bearer ${config.internalSecret}` },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toEqual({ clientId: CLIENT_ID, token: TOKEN })
  })
})
