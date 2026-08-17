// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'

// Same setup as token-captcha.test.ts (hCaptcha always fails), but also mocks
// isChatCaptchaVerified to simulate a fingerprint that already solved it
// within the last 24h (see chat-captcha.ts) — the join should succeed without
// a fresh hCaptcha solve. Isolated in its own file for the same reason as
// token-captcha.test.ts: these mocks would break token.test.ts's default
// dev-captcha-bypass case.
vi.mock('../../lib/hcaptcha.js', () => ({
  verifyHcaptcha: vi.fn(async () => false),
}))
vi.mock('../../lib/chat-captcha.js', () => ({
  isChatCaptchaVerified: vi.fn(async () => true),
  markChatCaptchaVerified: vi.fn(async () => undefined),
}))

import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { cleanupUsersByEmailPrefix, createTestArtist } from '../../test/helpers.js'

const PREFIX = 'chat-token-captcha-cached-'

describe('POST /api/chat/:slug/token — recently-verified fingerprint skips hCaptcha', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistSlug: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    artistSlug = 'chat-token-captcha-cached-artist'
    await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: artistSlug,
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98522,
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('joins an anonymous visitor with no hcaptchaToken when their fingerprint was recently verified', async () => {
    const res = await app.inject({
      method: 'POST',
      url: `/api/chat/${artistSlug}/token`,
      payload: { handle: 'returning-listener' },
    })
    expect(res.statusCode).toBe(200)
    expect(res.json().token).toBeTruthy()
    expect(res.json().handle).toBe('returning-listener')
  })
})
