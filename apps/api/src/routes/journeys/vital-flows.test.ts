// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

/**
 * End-to-end style journeys through the real Fastify app + Postgres.
 * Each `it` walks a full user-visible path (multi-step, shared DB).
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { FREE_WEEKLY_LIVE_CAP_SEC, utcWeekStart } from '@tahti/shared/broadcast-cap'
import {
  cleanupUsersByEmailPrefix,
  createEmailVerificationToken,
  createReadyArchiveItem,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'journey-'

describe('Vital flows (E2E journeys)', () => {
  let app: Awaited<ReturnType<typeof buildApp>>

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.user.deleteMany({ where: { memberNumber: { gte: 98000, lte: 98999 } } })
  })

  afterAll(async () => {
    await prisma.motion.deleteMany({
      where: { proposer: { email: { startsWith: PREFIX } } },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  it('artist onboarding: register → verify → pay membership → member export', async () => {
    const username = 'journey-onboard'
    const email = `${PREFIX}onboard@example.com`

    const reg = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: {
        email,
        password: 'strongpassword123',
        username,
        displayName: 'Journey Onboard',
      },
    })
    expect(reg.statusCode).toBe(201)

    const user = await prisma.user.findUnique({
      where: { email },
      include: { membership: true, channel: true },
    })
    expect(user!.membership!.status).toBe('PENDING_EMAIL')

    const loginBlocked = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'strongpassword123' },
    })
    expect(loginBlocked.statusCode).toBe(403)

    const token = await createEmailVerificationToken(prisma, user!.id)
    const verify = await app.inject({ method: 'GET', url: `/api/auth/verify?token=${token}` })
    expect(verify.statusCode).toBe(200)

    const pending = await prisma.membership.findUnique({ where: { userId: user!.id } })
    expect(pending!.status).toBe('PENDING_PAYMENT')

    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password: 'strongpassword123' },
    })
    expect(login.statusCode).toBe(200)
    const cookie = login.headers['set-cookie']?.toString().match(/tahti_session=[^;]+/)?.[0]
    expect(cookie).toBeDefined()

    const checkout = await app.inject({
      method: 'POST',
      url: '/api/me/membership/checkout',
      headers: { cookie: cookie! },
    })
    expect(checkout.statusCode).toBe(200)
    expect(checkout.json().activated).toBe(true)

    const me = await app.inject({
      method: 'GET',
      url: '/api/auth/me',
      headers: { cookie: cookie! },
    })
    expect(me.json().isMember).toBe(true)
    expect(me.json().tier).toBe('ARTIST')

    const board = await createTestArtist(prisma, {
      email: `${PREFIX}board-export@example.com`,
      username: 'journey-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98101,
    })
    const boardCookie = await sessionCookieFor(prisma, board.id)

    const csv = await app.inject({
      method: 'GET',
      url: '/api/admin/members/export.csv',
      headers: { cookie: boardCookie },
    })
    expect(csv.statusCode).toBe(200)
    expect(csv.headers['content-type']).toContain('text/csv')
    expect(csv.body).toContain(email)

    await prisma.user.delete({ where: { id: board.id } })
  })

  it('fan subscription journey: tier → subscribe → paid download weight 5×', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist-fan@example.com`,
      username: 'journey-artist-fan',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98102,
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: 'journey-fan',
      tier: 'FREE',
    })

    const artistCookie = await sessionCookieFor(prisma, artist.id)
    const fanCookie = await sessionCookieFor(prisma, fan.id)

    const tierRes = await app.inject({
      method: 'POST',
      url: '/api/me/fan-tiers',
      headers: { cookie: artistCookie },
      payload: { name: 'Supporter', amountCents: 500, perks: ['Early access'] },
    })
    expect(tierRes.statusCode).toBe(201)
    const tierId = tierRes.json().id

    const pub = await app.inject({ method: 'GET', url: '/api/v1/u/journey-artist-fan/tiers' })
    expect(pub.json().tiers).toHaveLength(1)

    const sub = await app.inject({
      method: 'POST',
      url: '/api/v1/u/journey-artist-fan/subscribe',
      headers: { cookie: fanCookie },
      payload: { tierId },
    })
    expect(sub.statusCode).toBe(201)

    const item = await createReadyArchiveItem(prisma, artist.channel!.id)
    const dl = await app.inject({
      method: 'GET',
      url: `/api/v1/c/journey-artist-fan/archive/${item.id}/download?fp=journey-fan-fp`,
      headers: { cookie: fanCookie, 'x-forwarded-for': '203.0.113.77' },
    })
    expect(dl.statusCode).toBe(200)

    const row = await prisma.download.findFirst({
      where: { archiveItemId: item.id, byUserId: fan.id },
    })
    expect(row?.weight).toBe(5)
  })

  it('free-tier broadcast cap blocks Icecast after weekly limit', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}cap@example.com`,
      username: 'journey-cap',
      tier: 'FREE',
      weeklyLiveSecondsUsed: FREE_WEEKLY_LIVE_CAP_SEC,
      weeklyLiveResetAt: utcWeekStart(new Date()),
    })

    const ch = await prisma.channel.findUnique({ where: { id: artist.channel!.id } })
    const res = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_connect',
      payload: { mount: `/live/${ch!.slug}`, pass: ch!.liveSourcePass },
    })
    expect(res.statusCode).toBe(403)
  })

  it('channel HLS manifest follows artist tier (MP3 vs FLAC)', async () => {
    const freeUser = await createTestArtist(prisma, {
      email: `${PREFIX}hls-free@example.com`,
      username: 'journey-hls-free',
      tier: 'FREE',
    })
    const paidUser = await createTestArtist(prisma, {
      email: `${PREFIX}hls-paid@example.com`,
      username: 'journey-hls-paid',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98103,
    })

    await prisma.channel.update({
      where: { id: freeUser.channel!.id },
      data: { state: 'LIVE' },
    })
    await prisma.channel.update({
      where: { id: paidUser.channel!.id },
      data: { state: 'LIVE' },
    })

    const freeCh = await app.inject({ method: 'GET', url: '/api/channels/journey-hls-free' })
    expect(freeCh.json().hlsUrl).toContain('stream-mp3-192')

    const paidCh = await app.inject({ method: 'GET', url: '/api/channels/journey-hls-paid' })
    expect(paidCh.json().hlsUrl).toContain('stream-flac')
  })

  it('public transparency endpoints respond', async () => {
    const cats = await app.inject({ method: 'GET', url: '/api/v1/transparency/categories' })
    expect(cats.statusCode).toBe(200)
    expect(cats.json().revenue).toBeDefined()

    const rollup = await app.inject({
      method: 'GET',
      url: `/api/v1/transparency/monthly_rollup?year=${new Date().getFullYear()}`,
    })
    expect(rollup.statusCode).toBe(200)
    expect(Array.isArray(rollup.json())).toBe(true)

    const grants = await app.inject({ method: 'GET', url: '/api/v1/transparency/grants/2031' })
    expect(grants.statusCode).toBe(200)
    expect(grants.json().year).toBe(2031)
  })

  it('governance: member lists directory, board opens motion, member votes', async () => {
    const board = await createTestArtist(prisma, {
      email: `${PREFIX}gov-board@example.com`,
      username: 'journey-gov-board',
      isBoard: true,
      isMember: true,
      memberNumber: 98111,
    })
    const member = await createTestArtist(prisma, {
      email: `${PREFIX}gov-member@example.com`,
      username: 'journey-gov-member',
      isMember: true,
      memberNumber: 98112,
    })

    const boardCookie = await sessionCookieFor(prisma, board.id)
    const memberCookie = await sessionCookieFor(prisma, member.id)

    const dir = await app.inject({
      method: 'GET',
      url: '/api/v1/governance/members',
      headers: { cookie: memberCookie },
    })
    expect(dir.statusCode).toBe(200)
    expect(dir.json().length).toBeGreaterThan(0)

    const motion = await app.inject({
      method: 'POST',
      url: '/api/v1/governance/motions',
      headers: { cookie: boardCookie },
      payload: {
        title: 'Test motion',
        description: 'Advisory vote on test policy.',
        openAt: new Date(Date.now() - 60_000).toISOString(),
        closeAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
      },
    })
    expect(motion.statusCode).toBe(201)
    const motionId = motion.json().id

    const open = await app.inject({
      method: 'PATCH',
      url: `/api/v1/governance/motions/${motionId}`,
      headers: { cookie: boardCookie },
      payload: { state: 'OPEN' },
    })
    expect(open.statusCode).toBe(200)

    const vote = await app.inject({
      method: 'POST',
      url: `/api/v1/governance/motions/${motionId}/vote`,
      headers: { cookie: memberCookie },
      payload: { choice: 'YES' },
    })
    expect(vote.statusCode).toBe(201)
  })
})
