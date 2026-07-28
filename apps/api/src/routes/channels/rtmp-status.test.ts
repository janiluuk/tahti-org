// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { createTestArtist, sessionCookieFor } from '../../test/helpers.js'

vi.mock('../../lib/orchestrator.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/orchestrator.js')>()
  return {
    ...actual,
    fetchRtmpTargetStatuses: vi.fn(async (_channelId: string, targetIds: string[]) =>
      Object.fromEntries(targetIds.map((id) => [id, { status: 'connected' as const }])),
    ),
  }
})

const PREFIX = 'rtmp-status-'

describe('GET /api/channels/:slug/rtmp-status', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let ownerCookie: string
  let boardCookie: string
  let strangerCookie: string
  let channelSlug: string
  let enabledTargetId: string
  let disabledTargetId: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })

    const owner = await createTestArtist(prisma, {
      email: `${PREFIX}owner@example.com`,
      username: `${PREFIX}owner`,
      tier: 'ARTIST',
    })
    channelSlug = owner.channel!.slug
    ownerCookie = await sessionCookieFor(prisma, owner.id)

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board@example.com`,
      username: `${PREFIX}board`,
      tier: 'ARTIST',
      isBoard: true,
    })
    boardCookie = await sessionCookieFor(prisma, board.id)

    const stranger = await createTestArtist(prisma, {
      email: `${PREFIX}stranger@example.com`,
      username: `${PREFIX}stranger`,
      tier: 'ARTIST',
    })
    strangerCookie = await sessionCookieFor(prisma, stranger.id)

    const enabled = await prisma.rtmpTarget.create({
      data: {
        channelId: owner.channel!.id,
        provider: 'YOUTUBE',
        label: 'Main YouTube',
        rtmpUrl: 'rtmp://a.rtmp.youtube.com/live2',
        streamKeyEnc: 'unused-in-this-test',
        enabled: true,
      },
    })
    enabledTargetId = enabled.id

    const disabled = await prisma.rtmpTarget.create({
      data: {
        channelId: owner.channel!.id,
        provider: 'TWITCH',
        label: 'Backup Twitch',
        rtmpUrl: 'rtmp://live.twitch.tv/app',
        streamKeyEnc: 'unused-in-this-test',
        enabled: false,
      },
    })
    disabledTargetId = disabled.id
  })

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { startsWith: PREFIX } } })
    await app.close()
  })

  it('requires auth', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/channels/${channelSlug}/rtmp-status` })
    expect(res.statusCode).toBe(401)
  })

  it('rejects a user who is neither the owner nor board', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelSlug}/rtmp-status`,
      headers: { cookie: strangerCookie },
    })
    expect(res.statusCode).toBe(403)
  })

  it('404s for an unknown channel', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/channels/does-not-exist/rtmp-status',
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(404)
  })

  it('lets the owner see enabled targets as live-checked and disabled targets as disabled', async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelSlug}/rtmp-status`,
      headers: { cookie: ownerCookie },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json() as Array<{ id: string; status: string; enabled: boolean }>
    expect(body).toHaveLength(2)

    const enabled = body.find((t) => t.id === enabledTargetId)
    expect(enabled?.enabled).toBe(true)
    expect(enabled?.status).toBe('connected')

    const disabled = body.find((t) => t.id === disabledTargetId)
    expect(disabled?.enabled).toBe(false)
    expect(disabled?.status).toBe('disabled')
  })

  it("lets a board member view another artist's channel status", async () => {
    const res = await app.inject({
      method: 'GET',
      url: `/api/channels/${channelSlug}/rtmp-status`,
      headers: { cookie: boardCookie },
    })
    expect(res.statusCode).toBe(200)
  })
})
