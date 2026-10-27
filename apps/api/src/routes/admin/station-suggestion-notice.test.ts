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

const PREFIX = 'station-suggestion-notice-'

describe('The listener who suggested a station is told the outcome', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let listenerId: string
  const presetIds: string[] = []

  const suggest = (name: string) =>
    prisma.radioStationSuggestion.create({
      data: {
        submitterId: listenerId,
        name,
        logoUrl: 'https://img.example/logo.png',
        language: 'Finnish',
        streamUrl: `https://stream.example.fi/${PREFIX}${name}.mp3`,
      },
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: `${PREFIX}listener`,
    })
    listenerId = listener.id
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
      isMember: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    await prisma.internetRadioPreset.deleteMany({ where: { id: { in: presetIds } } })
    await prisma.radioStationSuggestion.deleteMany({ where: { submitterId: listenerId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('notifies on approval and on rejection with the note', async () => {
    const accepted = await suggest('Lumo FM')
    const ok = await app.inject({
      method: 'POST',
      url: `/api/admin/radio-station-suggestions/${accepted.id}/approve`,
      headers: { cookie: boardCookie },
    })
    expect(ok.statusCode).toBe(200)
    presetIds.push(ok.json().presetId)

    const declined = await suggest('Static')
    const no = await app.inject({
      method: 'POST',
      url: `/api/admin/radio-station-suggestions/${declined.id}/reject`,
      headers: { cookie: boardCookie },
      payload: { note: 'Stream is offline' },
    })
    expect(no.statusCode).toBe(200)

    const notices = await prisma.notification.findMany({
      where: { userId: listenerId, type: 'RADIO_STATION_REVIEWED' },
      orderBy: { createdAt: 'asc' },
    })
    expect(notices.map((n) => [n.title, n.body, n.url])).toEqual([
      [
        'Lumo FM was accepted',
        'It shows on the Radio page once the board switches it on.',
        '/radio',
      ],
      ['Static was not added', 'Stream is offline', '/radio'],
    ])
  })
})
