// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'admin-inet-radio-'

describe('admin internet radio preset routes', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let boardCookie: string
  let presetId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      isBoard: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)
  })

  afterAll(async () => {
    if (presetId) await prisma.internetRadioPreset.deleteMany({ where: { id: presetId } })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('creates a preset defaulting to disabled', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/admin/internet-radio-presets',
      headers: { cookie: boardCookie },
      payload: { name: `${PREFIX}Station`, streamUrl: 'https://example.com/stream.m3u' },
    })
    expect(res.statusCode).toBe(201)
    const body = res.json() as { id: string; enabled: boolean }
    expect(body.enabled).toBe(false)
    presetId = body.id
  })

  it('toggles enabled via PATCH', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/internet-radio-presets/${presetId}`,
      headers: { cookie: boardCookie },
      payload: { enabled: true },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().enabled).toBe(true)

    const enabledCheck = await app.inject({
      method: 'GET',
      url: '/api/v1/internet-radio/presets/enabled',
    })
    const body = enabledCheck.json() as { presets: Array<{ id: string }> }
    expect(body.presets.some((p) => p.id === presetId)).toBe(true)
  })

  it('rejects a stream URL that is not HTTPS', async () => {
    const res = await app.inject({
      method: 'PATCH',
      url: `/api/admin/internet-radio-presets/${presetId}`,
      headers: { cookie: boardCookie },
      payload: { streamUrl: 'http://example.com/stream.mp3' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('Stream URL must start with https://')
  })

  it('audits creating, editing and removing a preset', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/admin/internet-radio-presets',
      headers: { cookie: boardCookie },
      payload: { name: `${PREFIX}Audited`, streamUrl: 'https://example.com/a.mp3' },
    })
    const auditedId = (created.json() as { id: string }).id

    await app.inject({
      method: 'PATCH',
      url: `/api/admin/internet-radio-presets/${auditedId}`,
      headers: { cookie: boardCookie },
      payload: { streamUrl: 'https://example.com/b.mp3', enabled: true },
    })
    const removed = await app.inject({
      method: 'DELETE',
      url: `/api/admin/internet-radio-presets/${auditedId}`,
      headers: { cookie: boardCookie },
    })
    expect(removed.statusCode).toBe(204)

    const audits = await prisma.auditLog.findMany({
      where: { targetId: auditedId },
      orderBy: { createdAt: 'asc' },
    })
    expect(audits.map((row) => row.action)).toEqual([
      'INTERNET_RADIO_PRESET_CREATE',
      'INTERNET_RADIO_PRESET_UPDATE',
      'INTERNET_RADIO_PRESET_DELETE',
    ])
    expect(audits[1]?.meta).toMatchObject({
      changes: {
        streamUrl: { from: 'https://example.com/a.mp3', to: 'https://example.com/b.mp3' },
        enabled: { from: false, to: true },
      },
    })
    await prisma.auditLog.deleteMany({ where: { targetId: auditedId } })
  })
})
