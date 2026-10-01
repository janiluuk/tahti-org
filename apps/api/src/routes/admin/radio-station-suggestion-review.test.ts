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

const PREFIX = 'radio-suggestion-review-'

describe('reviewing radio station suggestions', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let listenerCookie: string
  let listenerId: string
  const presetIds: string[] = []

  const makeSuggestion = (name: string) =>
    prisma.radioStationSuggestion.create({
      data: {
        submitterId: listenerId,
        name,
        logoUrl: 'https://img.example/logo.png',
        language: 'Finnish',
        bitrateKbps: 192,
        streamUrl: `https://stream.example.fi/${PREFIX}${name}.mp3`,
      },
    })

  const review = (
    id: string,
    action: 'approve' | 'reject',
    cookie = boardCookie,
    payload?: object,
  ) =>
    app.inject({
      method: 'POST',
      url: `/api/admin/radio-station-suggestions/${id}/${action}`,
      headers: { cookie },
      ...(payload ? { payload } : {}),
    })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    const listener = await createTestArtist(prisma, {
      email: `${PREFIX}listener@example.com`,
      username: 'radio-suggestion-review-listener',
    })
    listenerId = listener.id
    listenerCookie = await sessionCookieFor(prisma, listener.id)
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: 'radio-suggestion-review-board',
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

  it('approves a suggestion into a disabled preset', async () => {
    const suggestion = await makeSuggestion('lumo')
    const res = await review(suggestion.id, 'approve')
    expect(res.statusCode).toBe(200)
    const { presetId } = res.json() as { presetId: string }
    presetIds.push(presetId)
    const preset = await prisma.internetRadioPreset.findUnique({ where: { id: presetId } })
    expect(preset).toMatchObject({
      name: 'lumo',
      iconUrl: 'https://img.example/logo.png',
      streamUrl: `https://stream.example.fi/${PREFIX}lumo.mp3`,
      description: 'Finnish · 192 kbps',
      enabled: false,
    })
    const stored = await prisma.radioStationSuggestion.findUnique({ where: { id: suggestion.id } })
    expect(stored).toMatchObject({ status: 'APPROVED', presetId })
    expect(stored?.reviewedAt).toBeTruthy()

    const again = await review(suggestion.id, 'reject')
    expect(again.statusCode).toBe(409)
  })

  it('rejects with a note and creates nothing', async () => {
    const suggestion = await makeSuggestion('static')
    const presetsBefore = await prisma.internetRadioPreset.count()
    const res = await review(suggestion.id, 'reject', boardCookie, { note: 'Stream is offline' })
    expect(res.statusCode).toBe(200)
    expect(await prisma.internetRadioPreset.count()).toBe(presetsBefore)
    const stored = await prisma.radioStationSuggestion.findUnique({ where: { id: suggestion.id } })
    expect(stored).toMatchObject({ status: 'REJECTED', rejectionNote: 'Stream is offline' })
  })

  it('is board-only and 404s an unknown id', async () => {
    const suggestion = await makeSuggestion('guarded')
    expect((await review(suggestion.id, 'approve', listenerCookie)).statusCode).toBe(403)
    expect((await review('does-not-exist', 'approve')).statusCode).toBe(404)
  })
})
