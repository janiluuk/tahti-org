// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import dns from 'node:dns/promises'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

vi.mock('node:dns/promises', () => ({
  default: { resolveTxt: vi.fn() },
}))

const PREFIX = 'custom-domain-test-'

describe('PLAT-051 — custom domain resolution + management', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let freeCookie: string
  let paidCookie: string
  let paidChannelId: string
  let otherPaidCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const free = await createTestArtist(prisma, {
      email: `${PREFIX}free@example.com`,
      username: 'cd-free-artist',
      tier: 'FREE',
    })
    freeCookie = await sessionCookieFor(prisma, free.id)

    const paid = await createTestArtist(prisma, {
      email: `${PREFIX}paid@example.com`,
      username: 'cd-paid-artist',
      tier: 'ARTIST',
      isMember: true,
    })
    paidCookie = await sessionCookieFor(prisma, paid.id)
    paidChannelId = paid.channel!.id

    const otherPaid = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'cd-other-artist',
      tier: 'STUDIO',
      isMember: true,
    })
    otherPaidCookie = await sessionCookieFor(prisma, otherPaid.id)
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('rejects custom domain for FREE tier with 402', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/custom-domain',
      headers: { cookie: freeCookie },
      payload: { domain: 'freeartist.example.com' },
    })
    expect(res.statusCode).toBe(402)
  })

  it('rejects tahti.live subdomains as custom domain with 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/custom-domain',
      headers: { cookie: paidCookie },
      payload: { domain: 'someone.tahti.live' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('sets a custom domain for a paid tier and returns a TXT challenge', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/custom-domain',
      headers: { cookie: paidCookie },
      payload: { domain: 'https://Artist-Example.com/' },
    })
    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.domain).toBe('artist-example.com')
    expect(body.txtHost).toBe('_tahti-verify.artist-example.com')
    expect(body.txtRecord).toBe(`tahti-channel=${paidChannelId}`)
  })

  it('rejects a domain already claimed by another channel with 409', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/custom-domain',
      headers: { cookie: otherPaidCookie },
      payload: { domain: 'artist-example.com' },
    })
    expect(res.statusCode).toBe(409)
  })

  it('resolve returns 404 for an unverified domain', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/custom-domain/resolve?host=artist-example.com',
    })
    expect(res.statusCode).toBe(404)
  })

  it('verify fails with 400 when the TXT record is missing/mismatched', async () => {
    vi.mocked(dns.resolveTxt).mockResolvedValueOnce([['tahti-channel=not-the-right-id']])
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/custom-domain/verify',
      headers: { cookie: paidCookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('verify fails with 400 when DNS lookup throws', async () => {
    vi.mocked(dns.resolveTxt).mockRejectedValueOnce(new Error('ENOTFOUND'))
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/custom-domain/verify',
      headers: { cookie: paidCookie },
    })
    expect(res.statusCode).toBe(400)
  })

  it('verify succeeds once the TXT record matches, and resolve then succeeds', async () => {
    vi.mocked(dns.resolveTxt).mockResolvedValueOnce([[`tahti-channel=${paidChannelId}`]])
    const verify = await app.inject({
      method: 'POST',
      url: '/api/me/channel/custom-domain/verify',
      headers: { cookie: paidCookie },
    })
    expect(verify.statusCode).toBe(200)
    expect(verify.json().verified).toBe(true)

    const resolve = await app.inject({
      method: 'GET',
      url: '/api/v1/custom-domain/resolve?host=artist-example.com',
    })
    expect(resolve.statusCode).toBe(200)
    expect(resolve.json().slug).toBe('cd-paid-artist')
  })

  it('verify is idempotent once already verified (no DNS call needed)', async () => {
    vi.mocked(dns.resolveTxt).mockClear()
    const verify = await app.inject({
      method: 'POST',
      url: '/api/me/channel/custom-domain/verify',
      headers: { cookie: paidCookie },
    })
    expect(verify.statusCode).toBe(200)
    expect(verify.json().verified).toBe(true)
    expect(dns.resolveTxt).not.toHaveBeenCalled()
  })

  it('DELETE clears the custom domain so resolve 404s again', async () => {
    const del = await app.inject({
      method: 'DELETE',
      url: '/api/me/channel/custom-domain',
      headers: { cookie: paidCookie },
    })
    expect(del.statusCode).toBe(200)
    expect(del.json().ok).toBe(true)

    const resolve = await app.inject({
      method: 'GET',
      url: '/api/v1/custom-domain/resolve?host=artist-example.com',
    })
    expect(resolve.statusCode).toBe(404)
  })

  it('verify fails with 400 once domain has been cleared', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/me/channel/custom-domain/verify',
      headers: { cookie: paidCookie },
    })
    expect(res.statusCode).toBe(400)
  })
})
