// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * End-to-end style journeys through the real Fastify app + Postgres.
 * Each `it` walks a full user-visible path (multi-step, shared DB).
 */
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
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

// The Icecast on_connect/on_disconnect callbacks enqueue worker jobs (recording
// finalize + fallback cache warm) that need Redis/MinIO; stub them so the live
// broadcast journey below can drive the real ingest routes end to end.
const { enqueueFinalizeBroadcastRecording, enqueueWarmArchiveFallbackCache } = vi.hoisted(() => ({
  enqueueFinalizeBroadcastRecording: vi.fn().mockResolvedValue(undefined),
  enqueueWarmArchiveFallbackCache: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/queue.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/queue.js')>()
  return {
    ...actual,
    enqueueFinalizeBroadcastRecording,
    enqueueWarmArchiveFallbackCache,
  }
})

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

  it('catalog journey: upload 5 tracks → gate 1 as fan-only → fan downloads a free track, then purchases a fan tier to unlock it', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist-catalog@example.com`,
      username: 'journey-artist-catalog',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98113,
    })
    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan-catalog@example.com`,
      username: 'journey-fan-catalog',
      tier: 'FREE',
    })

    const artistCookie = await sessionCookieFor(prisma, artist.id)
    const fanCookie = await sessionCookieFor(prisma, fan.id)
    const ip = { 'x-forwarded-for': '203.0.113.91' }

    // 1. Artist uploads 5 tracks to their archive
    const tracks = []
    for (let i = 1; i <= 5; i++) {
      tracks.push(await createReadyArchiveItem(prisma, artist.channel!.id, `Catalog track ${i}`))
    }
    expect(tracks).toHaveLength(5)

    // 2. Artist marks one of them fan-only — the only per-item exclusivity gate
    // available is follow-to-download, which a non-follower can only satisfy by
    // becoming an active fan subscriber (see resolveDownloadGateStatus)
    const [fanOnlyTrack, freeTrack] = tracks
    const gatePatch = await app.inject({
      method: 'PATCH',
      url: `/api/me/archive/${fanOnlyTrack.id}`,
      headers: { cookie: artistCookie },
      payload: { followToDownload: true },
    })
    expect(gatePatch.statusCode).toBe(200)
    expect(gatePatch.json().followToDownload).toBe(true)

    // 3. Fan downloads one of the four remaining free tracks — no purchase needed
    const freeDl = await app.inject({
      method: 'GET',
      url: `/api/v1/c/journey-artist-catalog/archive/${freeTrack.id}/download?fp=journey-fan-catalog-free`,
      headers: { cookie: fanCookie, ...ip },
    })
    expect(freeDl.statusCode).toBe(200)
    const freeRow = await prisma.download.findFirst({
      where: { archiveItemId: freeTrack.id, byUserId: fan.id },
    })
    expect(freeRow?.weight).toBe(1)

    // The fan-only track stays locked — the fan neither follows nor subscribes yet
    const lockedDl = await app.inject({
      method: 'GET',
      url: `/api/v1/c/journey-artist-catalog/archive/${fanOnlyTrack.id}/download?fp=journey-fan-catalog-gated`,
      headers: { cookie: fanCookie, ...ip },
    })
    expect(lockedDl.statusCode).toBe(403)
    expect(lockedDl.json().gates).toContain('follow')

    // 4. Fan "purchases" the artist's support tier — the platform's actual
    // pay-the-artist mechanism — to unlock fan-only catalog content
    const tierRes = await app.inject({
      method: 'POST',
      url: '/api/me/fan-tiers',
      headers: { cookie: artistCookie },
      payload: { name: 'Inner Circle', amountCents: 700, perks: ['Fan-only tracks'] },
    })
    expect(tierRes.statusCode).toBe(201)
    const tierId = tierRes.json().id

    const sub = await app.inject({
      method: 'POST',
      url: '/api/v1/u/journey-artist-catalog/subscribe',
      headers: { cookie: fanCookie },
      payload: { tierId },
    })
    expect(sub.statusCode).toBe(201)

    // 5. The purchase satisfies the follow-to-download gate and pays the 5× weight
    const unlockedDl = await app.inject({
      method: 'GET',
      url: `/api/v1/c/journey-artist-catalog/archive/${fanOnlyTrack.id}/download?fp=journey-fan-catalog-gated`,
      headers: { cookie: fanCookie, ...ip },
    })
    expect(unlockedDl.statusCode).toBe(200)
    const gatedRow = await prisma.download.findFirst({
      where: { archiveItemId: fanOnlyTrack.id, byUserId: fan.id, format: { not: 'gate' } },
      orderBy: { createdAt: 'desc' },
    })
    expect(gatedRow?.weight).toBe(5)
  })

  it('live broadcast journey: 30s stream → 3 fans tune in → recording is archived and watchable in the channel history', async () => {
    enqueueFinalizeBroadcastRecording.mockClear()
    enqueueWarmArchiveFallbackCache.mockClear()

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist-live@example.com`,
      username: 'journey-artist-live',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98114,
    })
    const channel = await prisma.channel.findUniqueOrThrow({ where: { id: artist.channel!.id } })

    const fans = []
    for (let i = 1; i <= 3; i++) {
      fans.push(
        await createTestArtist(prisma, {
          email: `${PREFIX}fan-live-${i}@example.com`,
          username: `journey-fan-live-${i}`,
          tier: 'FREE',
        }),
      )
    }

    // 1. Artist's source connects — Icecast on_connect opens a Broadcast and
    // flips the channel live (PLAT-004 ingest callback)
    const connect = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_connect',
      payload: { mount: `/live/${channel.slug}`, pass: channel.liveSourcePass },
    })
    expect(connect.statusCode).toBe(200)
    expect((await prisma.channel.findUniqueOrThrow({ where: { id: channel.id } })).state).toBe(
      'PREVIEW',
    )

    // Artist confirms their signal in the studio preview, then promotes to public LIVE.
    const artistCookie = await sessionCookieFor(prisma, artist.id)
    const goLive = await app.inject({
      method: 'POST',
      url: '/api/me/channel/go-live',
      headers: { cookie: artistCookie },
    })
    expect(goLive.statusCode).toBe(200)
    expect((await prisma.channel.findUniqueOrThrow({ where: { id: channel.id } })).state).toBe(
      'LIVE',
    )

    const broadcast = await prisma.broadcast.findFirstOrThrow({
      where: { channelId: channel.id, endedAt: null },
      orderBy: { startedAt: 'desc' },
    })
    // Backdate the start so the session reflects an actual 30-second set
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { startedAt: new Date(Date.now() - 30_000) },
    })

    // 2. Three fans tune in while the channel is live
    for (const fan of fans) {
      const fanCookie = await sessionCookieFor(prisma, fan.id)
      const tuneIn = await app.inject({
        method: 'GET',
        url: '/api/channels/journey-artist-live',
        headers: { cookie: fanCookie },
      })
      expect(tuneIn.statusCode).toBe(200)
      expect(tuneIn.json().state).toBe('LIVE')
      expect(tuneIn.json().hlsUrl).toMatch(/^https?:\/\//)
    }

    // 3. Source disconnects 30s later — broadcast closes and the recording
    // finalize job is enqueued (mocked: it needs the worker's local filesystem)
    const disconnect = await app.inject({
      method: 'POST',
      url: '/internal/icecast/on_disconnect',
      payload: { mount: `/live/${channel.slug}` },
    })
    expect(disconnect.statusCode).toBe(200)
    expect(enqueueFinalizeBroadcastRecording).toHaveBeenCalledWith(broadcast.id)

    const ended = await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } })
    expect(ended.endedAt).toBeTruthy()
    expect(ended.endedAt!.getTime() - ended.startedAt.getTime()).toBeGreaterThanOrEqual(30_000)
    expect((await prisma.channel.findUniqueOrThrow({ where: { id: channel.id } })).state).toBe(
      'OFFLINE',
    )

    // 4. Stand in for the worker pipeline's end state: the recording lands as a
    // READY archive item and gets linked back onto the broadcast session
    const recording = await prisma.archiveItem.create({
      data: {
        channelId: channel.id,
        title: 'Live set — 30s broadcast',
        rawKey: `recordings/${channel.slug}/broadcast-${broadcast.id}.wav`,
        mp3Key: `mp3/${channel.slug}/broadcast-${broadcast.id}.mp3`,
        fileSizeBytes: BigInt(5_000_000),
        status: 'READY',
        isPublic: true,
        contentType: 'LIVE',
      },
    })
    await prisma.broadcast.update({
      where: { id: broadcast.id },
      data: { recordingKey: recording.rawKey, archiveItemId: recording.id },
    })

    // 5. The archived set now shows up in the channel's public history/back-catalog
    const items = await app.inject({
      method: 'GET',
      url: '/api/channels/journey-artist-live/items',
    })
    expect(items.statusCode).toBe(200)
    const entry = items.json().find((i: { id: string }) => i.id === recording.id)
    expect(entry).toBeTruthy()
    expect(entry.title).toBe('Live set — 30s broadcast')
    expect(entry.audioUrl).toMatch(/^https?:\/\//)

    expect(
      (await prisma.broadcast.findUniqueOrThrow({ where: { id: broadcast.id } })).archiveItemId,
    ).toBe(recording.id)
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

  it('channel HLS manifest is MP3 for every artist tier', async () => {
    // FLAC-in-MPEGTS has no MediaSource Extensions support in mainstream browsers —
    // see apps/api/src/lib/stream-quality.ts. Every tier gets the working MP3 variant.
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
    expect(paidCh.json().hlsUrl).toContain('stream-mp3-192')
  })

  it('hot rotation: previous RTMP key accepted at ingest after live rotate (ARTIST-002)', async () => {
    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}hot-rot@example.com`,
      username: 'journey-hot-rot',
      tier: 'ARTIST',
      isMember: true,
      memberNumber: 98104,
    })
    const cookie = await sessionCookieFor(prisma, artist.id)
    const ch = await prisma.channel.findUniqueOrThrow({ where: { userId: artist.id } })
    const oldKey = ch.rtmpStreamKey!

    await prisma.channel.update({ where: { id: ch.id }, data: { state: 'LIVE' } })

    const rotate = await app.inject({
      method: 'POST',
      url: '/api/me/stream-settings/rtmp/rotate',
      headers: { cookie },
    })
    expect(rotate.statusCode).toBe(200)

    const publish = await app.inject({
      method: 'POST',
      url: '/internal/rtmp/on_publish',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      payload: `name=${encodeURIComponent(oldKey)}`,
    })
    expect(publish.statusCode).toBe(200)

    await prisma.broadcast.deleteMany({ where: { channelId: ch.id } })
    await prisma.channel.update({
      where: { id: ch.id },
      data: { state: 'OFFLINE', goneLiveAt: null },
    })
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
