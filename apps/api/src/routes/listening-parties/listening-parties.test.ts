// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { prisma } from '@tahti/db'
import { buildApp } from '../../server.js'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'

const PREFIX = 'listening-party-test-'
const HOUR = 60 * 60 * 1000

type Artist = Awaited<ReturnType<typeof createTestArtist>>

async function createRelease(
  userId: string,
  opts: {
    state?: 'DRAFT' | 'PUBLISHED'
    releaseDate?: Date
    tracks?: { durationSec: number | null; streamKey: string | null }[]
  } = {},
) {
  const tracks = opts.tracks ?? [
    { durationSec: 100, streamKey: 'streams/lp-1.opus' },
    { durationSec: 100, streamKey: 'streams/lp-2.opus' },
    { durationSec: 100, streamKey: 'streams/lp-3.opus' },
  ]
  return prisma.release.create({
    data: {
      userId,
      title: 'Party Album',
      type: 'ALBUM',
      releaseDate: opts.releaseDate ?? new Date(Date.now() + 30 * 24 * HOUR),
      smartLinkSlug: `lp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      state: opts.state ?? 'DRAFT',
      commentary: 'The story behind the record.',
      credits: [
        { role: 'producer', name: 'Pat Producer', artistUsername: 'lp-host' },
        { role: 'engineer', name: 'leaked@example.com' },
      ],
      tracks: {
        create: tracks.map((t, i) => ({
          position: i + 1,
          title: `Track ${i + 1}`,
          durationSec: t.durationSec,
          streamKey: t.streamKey,
          status: 'READY' as const,
        })),
      },
    },
    include: { tracks: { orderBy: { position: 'asc' } } },
  })
}

/** A party row written directly, for states the API won't let you create. */
async function insertParty(host: Artist, releaseId: string, startAt: Date, canceledAt?: Date) {
  return prisma.listeningParty.create({
    data: {
      releaseId,
      channelId: host.channel!.id,
      hostUserId: host.id,
      startAt,
      canceledAt: canceledAt ?? null,
    },
  })
}

describe('listening parties', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let host: Artist
  let other: Artist
  let hostCookie: string
  let otherCookie: string

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    host = await createTestArtist(prisma, {
      email: `${PREFIX}host@example.com`,
      username: 'lp-host',
      // An email in the display name must never reach the response.
      displayName: 'host@example.com',
      tier: 'ARTIST',
    })
    other = await createTestArtist(prisma, {
      email: `${PREFIX}other@example.com`,
      username: 'lp-other',
      tier: 'ARTIST',
    })
    hostCookie = await sessionCookieFor(prisma, host.id)
    otherCookie = await sessionCookieFor(prisma, other.id)
  })

  beforeEach(async () => {
    await prisma.listeningParty.deleteMany({ where: { hostUserId: { in: [host.id, other.id] } } })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  function create(payload: object, cookie = hostCookie) {
    return app.inject({
      method: 'POST',
      url: '/api/me/listening-parties',
      headers: { cookie },
      payload,
    })
  }

  describe('POST /api/me/listening-parties', () => {
    it('requires a session', async () => {
      const res = await app.inject({
        method: 'POST',
        url: '/api/me/listening-parties',
        payload: {},
      })
      expect(res.statusCode).toBe(401)
    })

    it('creates a scheduled party with derived end time and safe names', async () => {
      const release = await createRelease(host.id)
      const startAt = new Date(Date.now() + 2 * HOUR)
      const res = await create({
        releaseId: release.id,
        startAt: startAt.toISOString(),
        hostNote: '**Welcome**',
      })
      expect(res.statusCode).toBe(201)
      const body = res.json()
      expect(body.state).toBe('SCHEDULED')
      expect(body.startAt).toBe(startAt.toISOString())
      expect(body.endAt).toBe(new Date(startAt.getTime() + 300_000).toISOString())
      expect(body.hostNote).toBe('**Welcome**')
      expect(body.nowPlaying).toBeNull()
      expect(body.serverNow).toBeTruthy()
      expect(body.host).toMatchObject({ username: 'lp-host', displayName: 'lp-host' })
      expect(body.channel).toMatchObject({ slug: 'lp-host', name: 'lp-host' })
      expect(body.release).toMatchObject({
        id: release.id,
        isPreRelease: true,
        smartLinkSlug: null,
        commentary: 'The story behind the record.',
      })
      expect(body.release.credits).toEqual([
        { role: 'producer', name: 'Pat Producer', artistUsername: 'lp-host' },
      ])
      expect(body.tracks.map((t: { position: number }) => t.position)).toEqual([1, 2, 3])
      expect(JSON.stringify(body)).not.toContain('@example.com')
    })

    it('rejects a start under 5 minutes or over 365 days away', async () => {
      const release = await createRelease(host.id)
      const soon = await create({
        releaseId: release.id,
        startAt: new Date(Date.now() + 60_000).toISOString(),
      })
      expect(soon.statusCode).toBe(400)
      const far = await create({
        releaseId: release.id,
        startAt: new Date(Date.now() + 400 * 24 * HOUR).toISOString(),
      })
      expect(far.statusCode).toBe(400)
    })

    it('rejects a release without tracks, durations or streams', async () => {
      const startAt = new Date(Date.now() + 2 * HOUR).toISOString()
      const empty = await createRelease(host.id, { tracks: [] })
      expect((await create({ releaseId: empty.id, startAt })).statusCode).toBe(400)
      const noDuration = await createRelease(host.id, {
        tracks: [{ durationSec: null, streamKey: 'streams/x.opus' }],
      })
      expect((await create({ releaseId: noDuration.id, startAt })).statusCode).toBe(400)
      const noStream = await createRelease(host.id, {
        tracks: [{ durationSec: 100, streamKey: null }],
      })
      expect((await create({ releaseId: noStream.id, startAt })).statusCode).toBe(400)
    })

    it("answers 404 for an unknown release and 403 for someone else's", async () => {
      const startAt = new Date(Date.now() + 2 * HOUR).toISOString()
      expect((await create({ releaseId: 'missing-release', startAt })).statusCode).toBe(404)
      const release = await createRelease(host.id)
      expect((await create({ releaseId: release.id, startAt }, otherCookie)).statusCode).toBe(403)
    })

    it('refuses an overlapping party on the same channel', async () => {
      const release = await createRelease(host.id)
      const first = new Date(Date.now() + 2 * HOUR)
      expect(
        (await create({ releaseId: release.id, startAt: first.toISOString() })).statusCode,
      ).toBe(201)
      const clash = await create({
        releaseId: release.id,
        startAt: new Date(first.getTime() + 120_000).toISOString(),
      })
      expect(clash.statusCode).toBe(409)
      const after = await create({
        releaseId: release.id,
        startAt: new Date(first.getTime() + 300_000).toISOString(),
      })
      expect(after.statusCode).toBe(201)
    })

    it('ignores canceled parties when checking overlap', async () => {
      const release = await createRelease(host.id)
      const startAt = new Date(Date.now() + 2 * HOUR)
      await insertParty(host, release.id, startAt, new Date())
      const res = await create({ releaseId: release.id, startAt: startAt.toISOString() })
      expect(res.statusCode).toBe(201)
    })
  })

  describe('GET /api/me/listening-parties', () => {
    it("lists only the caller's parties, latest first", async () => {
      const release = await createRelease(host.id)
      const early = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      const late = await insertParty(host, release.id, new Date(Date.now() + 5 * HOUR))
      const ended = await insertParty(host, release.id, new Date(Date.now() - 5 * HOUR))

      const res = await app.inject({
        method: 'GET',
        url: '/api/me/listening-parties',
        headers: { cookie: hostCookie },
      })
      expect(res.statusCode).toBe(200)
      const items = res.json().items as { id: string; state: string }[]
      expect(items.map((i) => i.id)).toEqual([late.id, early.id, ended.id])
      expect(items.map((i) => i.state)).toEqual(['SCHEDULED', 'SCHEDULED', 'ENDED'])

      const others = await app.inject({
        method: 'GET',
        url: '/api/me/listening-parties',
        headers: { cookie: otherCookie },
      })
      expect(others.json().items).toEqual([])
    })
  })

  describe('PATCH /api/me/listening-parties/:id', () => {
    function patch(id: string, payload: object, cookie = hostCookie) {
      return app.inject({
        method: 'PATCH',
        url: `/api/me/listening-parties/${id}`,
        headers: { cookie },
        payload,
      })
    }

    it('updates the note and start time while scheduled', async () => {
      const release = await createRelease(host.id)
      const party = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      const startAt = new Date(Date.now() + 3 * HOUR).toISOString()
      const res = await patch(party.id, { startAt, hostNote: 'Moved' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ startAt, hostNote: 'Moved', state: 'SCHEDULED' })
    })

    it('answers 403 to someone else and 404 for an unknown party', async () => {
      const release = await createRelease(host.id)
      const party = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      expect((await patch(party.id, { hostNote: 'x' }, otherCookie)).statusCode).toBe(403)
      expect((await patch('missing-party', { hostNote: 'x' })).statusCode).toBe(404)
    })

    it('rejects a new start inside the 5 minute window', async () => {
      const release = await createRelease(host.id)
      const party = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      const res = await patch(party.id, { startAt: new Date(Date.now() + 60_000).toISOString() })
      expect(res.statusCode).toBe(400)
    })

    it('refuses a move onto another party', async () => {
      const release = await createRelease(host.id)
      const party = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      const blocker = await insertParty(host, release.id, new Date(Date.now() + 3 * HOUR))
      const res = await patch(party.id, {
        startAt: new Date(blocker.startAt.getTime() + 60_000).toISOString(),
      })
      expect(res.statusCode).toBe(409)
    })

    it('answers 409 once the party is live, ended or canceled', async () => {
      const release = await createRelease(host.id)
      const live = await insertParty(host, release.id, new Date(Date.now() - 10_000))
      const ended = await insertParty(host, release.id, new Date(Date.now() - 3 * HOUR))
      const canceled = await insertParty(
        host,
        release.id,
        new Date(Date.now() + 5 * HOUR),
        new Date(),
      )
      for (const p of [live, ended, canceled]) {
        expect((await patch(p.id, { hostNote: 'late' })).statusCode).toBe(409)
      }
    })
  })

  describe('POST /api/me/listening-parties/:id/cancel', () => {
    function cancel(id: string, cookie = hostCookie) {
      return app.inject({
        method: 'POST',
        url: `/api/me/listening-parties/${id}/cancel`,
        headers: { cookie },
      })
    }

    it('cancels, and canceling again returns it unchanged', async () => {
      const release = await createRelease(host.id)
      const party = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      const first = await cancel(party.id)
      expect(first.statusCode).toBe(200)
      expect(first.json().state).toBe('CANCELED')
      const again = await cancel(party.id)
      expect(again.statusCode).toBe(200)
      expect(again.json().state).toBe('CANCELED')
    })

    it('cancels a live party', async () => {
      const release = await createRelease(host.id)
      const party = await insertParty(host, release.id, new Date(Date.now() - 10_000))
      expect((await cancel(party.id)).json().state).toBe('CANCELED')
    })

    it('answers 409 once ended and 403 to someone else', async () => {
      const release = await createRelease(host.id)
      const ended = await insertParty(host, release.id, new Date(Date.now() - 3 * HOUR))
      expect((await cancel(ended.id)).statusCode).toBe(409)
      const party = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      expect((await cancel(party.id, otherCookie)).statusCode).toBe(403)
    })
  })

  describe('GET /api/v1/listening-parties/:id', () => {
    it('answers 404 for an unknown party', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/v1/listening-parties/missing' })
      expect(res.statusCode).toBe(404)
    })

    it('shows a live party with the current track and offset', async () => {
      const release = await createRelease(host.id)
      const party = await insertParty(host, release.id, new Date(Date.now() - 150_000))
      const res = await app.inject({ method: 'GET', url: `/api/v1/listening-parties/${party.id}` })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.state).toBe('LIVE')
      expect(body.nowPlaying.trackId).toBe(release.tracks[1]!.id)
      expect(body.nowPlaying.position).toBe(2)
      expect(body.nowPlaying.offsetSec).toBeGreaterThanOrEqual(50)
      expect(body.nowPlaying.offsetSec).toBeLessThan(60)
    })

    it('still returns a canceled party', async () => {
      const release = await createRelease(host.id)
      const party = await insertParty(host, release.id, new Date(Date.now() + HOUR), new Date())
      const res = await app.inject({ method: 'GET', url: `/api/v1/listening-parties/${party.id}` })
      expect(res.statusCode).toBe(200)
      expect(res.json().state).toBe('CANCELED')
    })

    it("carries the host's purchase tiers only while the store is on", async () => {
      const release = await createRelease(host.id)
      const party = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      const tier = await prisma.purchaseTier.create({
        data: { artistUserId: host.id, name: 'Digital album', priceCents: 900 },
      })
      try {
        const closed = await app.inject({
          method: 'GET',
          url: `/api/v1/listening-parties/${party.id}`,
        })
        expect(closed.json().purchaseTiers).toEqual([])

        await prisma.channel.update({
          where: { id: host.channel!.id },
          data: { storeEnabled: true },
        })
        const open = await app.inject({
          method: 'GET',
          url: `/api/v1/listening-parties/${party.id}`,
        })
        expect(open.json().purchaseTiers).toEqual([
          {
            id: tier.id,
            name: 'Digital album',
            description: null,
            priceCents: 900,
            priceOptional: false,
            currency: 'EUR',
          },
        ])
      } finally {
        await prisma.channel.update({
          where: { id: host.channel!.id },
          data: { storeEnabled: false },
        })
        await prisma.purchaseTier.delete({ where: { id: tier.id } })
      }
    })
  })

  describe('GET /api/v1/listening-parties/:id/tracks/:trackId/stream', () => {
    function stream(partyId: string, trackId: string) {
      return app.inject({
        method: 'GET',
        url: `/api/v1/listening-parties/${partyId}/tracks/${trackId}/stream`,
      })
    }

    it('gates a pre-release track to the live party and tracks already reached', async () => {
      const release = await createRelease(host.id)
      const [t1, t2, t3] = release.tracks
      const live = await insertParty(host, release.id, new Date(Date.now() - 150_000))

      const current = await stream(live.id, t2!.id)
      expect(current.statusCode).toBe(302)
      expect(current.headers.location).toBeTruthy()
      expect((await stream(live.id, t1!.id)).statusCode).toBe(302)
      expect((await stream(live.id, t3!.id)).statusCode).toBe(403)
    })

    it('refuses a pre-release track before the party, after it and once canceled', async () => {
      const release = await createRelease(host.id)
      const trackId = release.tracks[0]!.id
      const scheduled = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      const ended = await insertParty(host, release.id, new Date(Date.now() - 3 * HOUR))
      const canceled = await insertParty(
        host,
        release.id,
        new Date(Date.now() - 10_000),
        new Date(),
      )
      for (const p of [scheduled, ended, canceled]) {
        expect((await stream(p.id, trackId)).statusCode).toBe(403)
      }
    })

    it('streams a released track like the normal stream, whatever the party state', async () => {
      const release = await createRelease(host.id, {
        state: 'PUBLISHED',
        releaseDate: new Date(Date.now() - 24 * HOUR),
      })
      const scheduled = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      const res = await stream(scheduled.id, release.tracks[2]!.id)
      expect(res.statusCode).toBe(302)
    })

    it('treats a published release with a future release date as pre-release', async () => {
      const release = await createRelease(host.id, { state: 'PUBLISHED' })
      const scheduled = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      expect((await stream(scheduled.id, release.tracks[0]!.id)).statusCode).toBe(403)
    })

    it("answers 404 for a track that isn't on the party's release", async () => {
      const release = await createRelease(host.id)
      const otherRelease = await createRelease(host.id)
      const live = await insertParty(host, release.id, new Date(Date.now() - 10_000))
      expect((await stream(live.id, otherRelease.tracks[0]!.id)).statusCode).toBe(404)
    })
  })

  describe('GET /api/channels/:slug/listening-parties', () => {
    it('lists live and scheduled parties, soonest first', async () => {
      const release = await createRelease(host.id)
      const live = await insertParty(host, release.id, new Date(Date.now() - 10_000))
      const later = await insertParty(host, release.id, new Date(Date.now() + 5 * HOUR))
      const sooner = await insertParty(host, release.id, new Date(Date.now() + HOUR))
      await insertParty(host, release.id, new Date(Date.now() - 3 * HOUR))
      await insertParty(host, release.id, new Date(Date.now() + 2 * HOUR), new Date())

      const res = await app.inject({
        method: 'GET',
        url: '/api/channels/lp-host/listening-parties',
      })
      expect(res.statusCode).toBe(200)
      const items = res.json().items as { id: string; state: string }[]
      expect(items.map((i) => i.id)).toEqual([live.id, sooner.id, later.id])
      expect(items.map((i) => i.state)).toEqual(['LIVE', 'SCHEDULED', 'SCHEDULED'])
    })

    it('answers 404 for an unknown channel', async () => {
      const res = await app.inject({
        method: 'GET',
        url: '/api/channels/lp-nobody/listening-parties',
      })
      expect(res.statusCode).toBe(404)
    })
  })
})
