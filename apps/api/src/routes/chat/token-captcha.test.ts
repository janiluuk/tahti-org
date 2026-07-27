// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Simulates HCAPTCHA_SECRET being a real, non-dev value with a captcha check
// that fails — the exact condition that made every signed-in member unable
// to join a channel's chat, since chat-panel.tsx never renders a captcha
// widget for this endpoint (see the comment in token.ts). Isolated in its
// own file since this mock would otherwise break token.test.ts's anonymous
// "supporter: false" case, which relies on the default dev captcha bypass.
vi.mock('../../lib/hcaptcha.js', () => ({
  verifyHcaptcha: vi.fn(async () => false),
}))

import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'chat-token-captcha-'

describe('POST /api/chat/:slug/token — hCaptcha required but failing', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistSlug: string
  let memberCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    artistSlug = 'chat-token-captcha-artist'
    await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: artistSlug,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98521,
    })

    const member = await createTestArtist(prisma, {
      email: `${PREFIX}member@example.com`,
      username: `${PREFIX}member`,
      tier: 'FREE',
    })
    memberCookie = await sessionCookieFor(prisma, member.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects an anonymous join when hCaptcha verification fails', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/${artistSlug}/token`,
      payload: { handle: 'anon-listener' },
    })
    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('hCaptcha verification failed')
  })

  it('still lets a signed-in user join — an authenticated session is a stronger anti-abuse signal than a captcha the UI never asks for', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/${artistSlug}/token`,
      headers: { cookie: memberCookie },
      payload: { handle: 'signed-in-member' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().token).toBeTruthy()
    expect(res.json().handle).toBe('signed-in-member')
  })
})
