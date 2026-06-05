// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Persona journeys — listener (public), artist (studio), member (governance).
 * Complements bash tests/e2e/user-journeys.sh and seed-e2e-screenshots fixtures.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import {
  cleanupUsersByEmailPrefix,
  createPublishedReleaseWithTrack,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'persona-'

async function createTestMember(
  email: string,
  username: string,
  opts?: { isMember?: boolean; memberNumber?: number },
) {
  const { hashPassword } = await import('../../lib/password.js')
  const passwordHash = await hashPassword('testpassword')
  return prisma.user.create({
    data: {
      email,
      passwordHash,
      username,
      displayName: username,
      emailVerifiedAt: new Date(),
      isMember: opts?.isMember ?? true,
      memberNumber: opts?.memberNumber,
      memberSince: opts?.isMember !== false ? new Date() : undefined,
      membership: {
        create: {
          status: opts?.isMember !== false ? 'ACTIVE' : 'PENDING_PAYMENT',
          activatedAt: opts?.isMember !== false ? new Date() : undefined,
        },
      },
    },
    include: { membership: true },
  })
}

describe('Persona journeys', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let artistSlug: string
  let smartSlug: string
  let memberCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await prisma.motion.deleteMany({
      where: { proposer: { email: { startsWith: PREFIX } } },
    })

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: `${PREFIX}artist`,
      isMember: true,
      memberNumber: 98101,
      tier: 'ARTIST',
    })
    artistSlug = artist.username
    const release = await createPublishedReleaseWithTrack(prisma, artist.id, {
      smartLinkSlug: `${PREFIX}ep`,
    })
    smartSlug = release.smartLinkSlug!

    await prisma.fanTier.create({
      data: {
        artistUserId: artist.id,
        name: 'Supporter',
        amountCents: 500,
        description: 'Test tier',
        perks: [],
        position: 0,
        active: true,
      },
    })

    const member = await createTestMember(`${PREFIX}member@example.com`, `${PREFIX}member`, {
      memberNumber: 98102,
    })
    memberCookie = await sessionCookieFor(prisma, member.id)

    const now = new Date()
    await prisma.motion.create({
      data: {
        title: `${PREFIX} motion`,
        description: 'Persona journey motion',
        proposedBy: artist.id,
        advisory: true,
        state: 'OPEN',
        openAt: new Date(now.getTime() - 60_000),
        closeAt: new Date(now.getTime() + 86_400_000),
      },
    })
  })

  afterAll(async () => {
    await prisma.motion.deleteMany({
      where: { proposer: { email: { startsWith: PREFIX } } },
    })
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  describe('listener', () => {
    it('browses profile, channel, tiers, and smart link without auth', async () => {
      const profile = await app.inject({
        method: 'GET',
        url: `/api/v1/u/${artistSlug}/profile`,
      })
      expect(profile.statusCode).toBe(200)
      expect(profile.json().artist.username).toBe(artistSlug)

      const channel = await app.inject({
        method: 'GET',
        url: `/api/channels/${artistSlug}`,
      })
      expect(channel.statusCode).toBe(200)

      const tiers = await app.inject({
        method: 'GET',
        url: `/api/v1/u/${artistSlug}/tiers`,
      })
      expect(tiers.statusCode).toBe(200)
      expect(tiers.json().tiers?.length ?? 0).toBeGreaterThan(0)

      const smart = await app.inject({
        method: 'GET',
        url: `/api/v1/r/${smartSlug}`,
      })
      expect(smart.statusCode).toBe(200)

      const ytd = await app.inject({ method: 'GET', url: '/api/v1/transparency/ytd' })
      expect(ytd.statusCode).toBe(200)
    })
  })

  describe('artist', () => {
    it('logs in and uses studio APIs', async () => {
      const artist = await prisma.user.findUnique({
        where: { email: `${PREFIX}artist@example.com` },
      })
      const cookie = await sessionCookieFor(prisma, artist!.id)

      const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie },
      })
      expect(me.json().isMember).toBe(true)
      expect(me.json().channel).toBeTruthy()

      const releases = await app.inject({
        method: 'GET',
        url: '/api/me/releases',
        headers: { cookie },
      })
      expect(releases.statusCode).toBe(200)
      expect(releases.json().length).toBeGreaterThan(0)

      const stream = await app.inject({
        method: 'GET',
        url: '/api/me/stream-settings',
        headers: { cookie },
      })
      expect(stream.statusCode).toBe(200)
      expect(stream.json().rtmp?.server).toBeTruthy()

      const archive = await app.inject({
        method: 'GET',
        url: '/api/me/archive',
        headers: { cookie },
      })
      expect(archive.statusCode).toBe(200)

      const gates = await app.inject({
        method: 'GET',
        url: '/api/me/download-gate-stats',
        headers: { cookie },
      })
      expect(gates.statusCode).toBe(200)
      expect(gates.json().items).toBeDefined()

      const channelItems = await app.inject({
        method: 'GET',
        url: `/api/channels/${artistSlug}/items`,
      })
      expect(channelItems.statusCode).toBe(200)

      const embed = await app.inject({
        method: 'GET',
        url: `/api/v1/embed/c/${artistSlug}`,
      })
      expect(embed.statusCode).toBe(200)
      expect(embed.json().profileUrl).toContain(`/u/${artistSlug}`)
    })
  })

  describe('member', () => {
    it('rejects governance for anonymous users', async () => {
      const members = await app.inject({ method: 'GET', url: '/api/v1/governance/members' })
      expect(members.statusCode).toBe(401)
    })

    it('lists governance directory and motions when logged in', async () => {
      const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: memberCookie },
      })
      expect(me.json().isMember).toBe(true)
      expect(me.json().channel).toBeNull()

      const members = await app.inject({
        method: 'GET',
        url: '/api/v1/governance/members',
        headers: { cookie: memberCookie },
      })
      expect(members.statusCode).toBe(200)
      expect(members.json().some((m: { username: string }) => m.username === artistSlug)).toBe(true)

      const motions = await app.inject({
        method: 'GET',
        url: '/api/v1/governance/motions',
        headers: { cookie: memberCookie },
      })
      expect(motions.statusCode).toBe(200)
      expect(motions.json().some((m: { title: string }) => m.title.includes(PREFIX))).toBe(true)
    })
  })

  describe('director', () => {
    it('rejects admin routes for anonymous users', async () => {
      const preview = await app.inject({
        method: 'GET',
        url: '/api/admin/grants/preview/2031',
      })
      expect(preview.statusCode).toBe(401)

      const exportCsv = await app.inject({
        method: 'GET',
        url: '/api/admin/members/export.csv',
      })
      expect(exportCsv.statusCode).toBe(401)
    })

    it('previews grants and exports members when logged in as board', async () => {
      const board = await createTestMember(`${PREFIX}board@example.com`, `${PREFIX}board`, {
        memberNumber: 98103,
      })
      await prisma.user.update({ where: { id: board.id }, data: { isBoard: true } })
      const boardCookie = await sessionCookieFor(prisma, board.id)

      const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: boardCookie },
      })
      expect(me.json().isBoard).toBe(true)

      const preview = await app.inject({
        method: 'GET',
        url: '/api/admin/grants/preview/2031',
        headers: { cookie: boardCookie },
      })
      expect(preview.statusCode).toBe(200)
      expect(preview.json().forYear).toBe(2031)

      const members = await app.inject({
        method: 'GET',
        url: '/api/admin/members',
        headers: { cookie: boardCookie },
      })
      expect(members.statusCode).toBe(200)
      expect(Array.isArray(members.json())).toBe(true)

      const exportCsv = await app.inject({
        method: 'GET',
        url: '/api/admin/members/export.csv',
        headers: { cookie: boardCookie },
      })
      expect(exportCsv.statusCode).toBe(200)
      expect(exportCsv.headers['content-type']).toContain('text/csv')

      const grants = await app.inject({ method: 'GET', url: '/api/v1/transparency/grants/2031' })
      expect(grants.statusCode).toBe(200)
    })
  })

  describe('ops', () => {
    it('exposes health, status, and Prometheus metrics', async () => {
      const health = await app.inject({ method: 'GET', url: '/health' })
      expect(health.statusCode).toBe(200)
      expect(health.json().checks.postgres).toBe('up')

      const status = await app.inject({ method: 'GET', url: '/api/v1/status' })
      expect([200, 503]).toContain(status.statusCode)
      expect(status.json().checks).toBeDefined()
      expect(status.json().checks.postgres?.state).toBe('up')

      const metrics = await app.inject({ method: 'GET', url: '/metrics' })
      expect(metrics.statusCode).toBe(200)
      expect(metrics.body).toContain('tahti_api_healthy')
      expect(metrics.body).toContain('tahti_api_uptime_seconds')
    })
  })
})
