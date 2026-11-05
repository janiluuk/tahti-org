// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createReadySound,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'sound-suggest-'

describe('POST /api/me/sound/suggest-playlist', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let cookie = ''
  const ids: Record<string, string> = {}

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const me = await createTestArtist(prisma, {
      email: `${PREFIX}me@example.com`,
      username: `${PREFIX}me`,
    })
    const other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: `${PREFIX}other`,
    })
    cookie = await sessionCookieFor(prisma, me.id)
    const make = async (name: string, channelId: string, data: object) => {
      const sound = await createReadySound(prisma, channelId, name)
      await prisma.sound.update({ where: { id: sound.id }, data })
      ids[name] = sound.id
    }
    await make('warm', me.channel!.id, { bpm: 118, musicalKey: 'Am' })
    await make('detected', me.channel!.id, {
      bpm: 90,
      musicalKey: 'C#',
      bpmDetected: 121,
      keyDetected: '9A',
      useDetectedBpmKey: true,
    })
    await make('keyless', me.channel!.id, { bpm: 120 })
    await make('theirs', other.channel!.id, { bpm: 100, musicalKey: 'Am' })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  const suggest = (payload: object, withCookie = true) =>
    app.inject({
      method: 'POST',
      url: '/api/me/sound/suggest-playlist',
      headers: withCookie ? { cookie } : {},
      payload,
    })

  it('orders your sounds by key and tempo, using detected values when chosen', async () => {
    const res = await suggest({
      ids: [ids.keyless, ids.detected, ids.theirs, ids.warm],
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as {
      items: Array<{ id: string; camelot: string; bpm: number }>
      unplaced: Array<{ id: string }>
    }
    expect(body.items.map((t) => [t.id, t.camelot, t.bpm])).toEqual([
      [ids.warm, '8A', 118],
      [ids.detected, '9A', 121],
    ])
    expect(body.unplaced.map((t) => t.id)).toEqual([ids.keyless])
  })

  it('needs a session and at least two ids', async () => {
    expect((await suggest({ ids: [ids.warm, ids.detected] }, false)).statusCode).toBe(401)
    expect((await suggest({ ids: [ids.warm] })).statusCode).toBe(400)
  })
})
