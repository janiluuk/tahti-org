// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { buildApp } from '../../server.js'
import { prisma } from '@tahti/db'
import { BROADCAST_RECONNECT_GRACE_MS } from '@tahti/shared'
import { endExpiredReconnectingBroadcasts } from '@tahti/shared/broadcast-end'
import {
  cleanupUsersByEmailPrefix,
  createTestArtist,
  sessionCookieFor,
} from '../../test/helpers.js'
import { publicMediaUrl } from '../../lib/public-media-url.js'

const { enqueueFinalizeBroadcastRecording, restartChannelLiquidsoap } = vi.hoisted(() => ({
  enqueueFinalizeBroadcastRecording: vi.fn().mockResolvedValue(undefined),
  restartChannelLiquidsoap: vi.fn().mockResolvedValue(undefined),
}))

vi.mock('../../lib/queue.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/queue.js')>()
  return {
    ...actual,
    enqueueFinalizeBroadcastRecording,
    enqueueWarmSoundFallbackCache: vi.fn().mockResolvedValue(undefined),
  }
})

vi.mock('../../lib/orchestrator.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/orchestrator.js')>()
  return {
    ...actual,
    spawnChannelLiquidsoap: vi.fn().mockResolvedValue(undefined),
    stopOrchestratorChannel: vi.fn().mockResolvedValue(undefined),
    restartChannelLiquidsoap,
  }
})

// Public channel payloads are cached per slug; these tests flip the same channel's state.
vi.mock('../../lib/json-cache.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../lib/json-cache.js')>()
  return {
    ...actual,
    getCachedJson: <T>(_key: string, _ttl: number, compute: () => Promise<T>) => compute(),
  }
})

const PREFIX = 'golive-show-info-'
const ARTIST = 'golive-artist'
const AVATAR = 'https://cdn.example.test/avatars/golive-artist.png'
const form = { 'content-type': 'application/x-www-form-urlencoded' }
const afterGrace = () => new Date(Date.now() + BROADCAST_RECONNECT_GRACE_MS + 1000)

describe('Go live show info, PRIVATE visibility and reconnecting', () => {
  let app: Awaited<ReturnType<typeof buildApp>>
  let channelId: string
  let artistCookie: string
  let fanCookie: string
  let liveSourcePass: string
  let seriesId: string

  const connect = () =>
    app.inject({
      method: 'POST',
      url: '/internal/icecast/on_connect',
      headers: form,
      payload: `mount=/live/${ARTIST}&pass=${liveSourcePass}`,
    })
  const disconnect = () =>
    app.inject({
      method: 'POST',
      url: '/internal/icecast/on_disconnect',
      headers: form,
      payload: `mount=/live/${ARTIST}`,
    })
  const goLive = () =>
    app.inject({
      method: 'POST',
      url: '/api/me/channel/go-live',
      headers: { cookie: artistCookie },
    })
  const patch = (payload: Record<string, unknown>) =>
    app.inject({
      method: 'PATCH',
      url: '/api/me/channel/preflight',
      headers: { cookie: artistCookie },
      payload,
    })
  const getPreflight = () =>
    app.inject({
      method: 'GET',
      url: '/api/me/channel/preflight',
      headers: { cookie: artistCookie },
    })
  const signalStatus = () =>
    app.inject({
      method: 'GET',
      url: '/api/me/stream-settings/status',
      headers: { cookie: artistCookie },
    })
  const openBroadcasts = () => prisma.broadcast.findMany({ where: { channelId, endedAt: null } })

  beforeAll(async () => {
    app = await buildApp({ logger: false })
    await app.ready()
    await cleanupUsersByEmailPrefix(prisma, PREFIX)

    const artist = await createTestArtist(prisma, {
      email: `${PREFIX}artist@example.com`,
      username: ARTIST,
      displayName: 'Golive Artist',
      tier: 'ARTIST',
    })
    await prisma.user.update({ where: { id: artist.id }, data: { avatarUrl: AVATAR } })
    channelId = artist.channel!.id
    liveSourcePass = artist.channel!.liveSourcePass
    artistCookie = await sessionCookieFor(prisma, artist.id)

    const fan = await createTestArtist(prisma, {
      email: `${PREFIX}fan@example.com`,
      username: 'golive-fan',
      displayName: 'Golive Fan',
    })
    await prisma.fanSubscription.create({
      data: {
        artistUserId: artist.id,
        subscriberUserId: fan.id,
        tierName: 'Supporter',
        amountCents: 500,
        stripeSubscriptionId: `${PREFIX}sub`,
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      },
    })
    fanCookie = await sessionCookieFor(prisma, fan.id)

    seriesId = (
      await prisma.liveShowSeries.create({
        data: { channelId, name: 'Night Shift', episodeNumberEnabled: true, nextEpisodeNumber: 4 },
      })
    ).id
  })

  beforeEach(async () => {
    enqueueFinalizeBroadcastRecording.mockClear()
    restartChannelLiquidsoap.mockClear()
    await prisma.broadcast.deleteMany({ where: { channelId } })
    await prisma.scheduledLiveShow.deleteMany({ where: { channelId } })
    await prisma.broadcastShowDraft.deleteMany({ where: { channelId } })
    await prisma.rtmpTarget.deleteMany({ where: { channelId } })
    await prisma.channel.update({
      where: { id: channelId },
      data: { state: 'OFFLINE', goneLiveAt: null, autoRecordEnabled: true },
    })
  })

  afterAll(async () => {
    await cleanupUsersByEmailPrefix(prisma, PREFIX)
    await app.close()
  })

  describe('pre-session draft', () => {
    it('saves show info before the encoder connects and returns it from GET', async () => {
      const res = await patch({
        title: 'Sunday Session',
        tagline: 'Deep cuts only',
        showType: 'TALK',
        visibility: 'FAN_ONLY',
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        session: 'NONE',
        title: 'Sunday Session',
        tagline: 'Deep cuts only',
        showType: 'TALK',
        visibility: 'FAN_ONLY',
        seriesId: null,
      })

      const partial = await patch({ tagline: 'Warm-up first' })
      expect(partial.json()).toMatchObject({ title: 'Sunday Session', tagline: 'Warm-up first' })

      const get = await getPreflight()
      expect(get.statusCode).toBe(200)
      expect(get.json()).toMatchObject({
        session: 'NONE',
        title: 'Sunday Session',
        tagline: 'Warm-up first',
        showType: 'TALK',
        visibility: 'FAN_ONLY',
      })
    })

    it('treats a 24/7 fallback placeholder as no session', async () => {
      await prisma.channel.update({ where: { id: channelId }, data: { state: 'LIVE' } })
      await prisma.broadcast.create({ data: { channelId, source: 'ICECAST' } })

      const res = await patch({ title: 'Before the encoder' })
      expect(res.statusCode).toBe(200)
      expect(res.json().session).toBe('NONE')
      const draft = await prisma.broadcastShowDraft.findUnique({ where: { channelId } })
      expect(draft?.title).toBe('Before the encoder')
    })

    it('rejects a series that is not the channel’s', async () => {
      const res = await patch({ seriesId: 'not-a-series' })
      expect(res.statusCode).toBe(404)
    })

    it('applies the draft to the new broadcast on connect and clears it', async () => {
      await patch({ title: 'Sunday Session', tagline: 'Deep cuts only', visibility: 'FAN_ONLY' })

      expect((await connect()).statusCode).toBe(200)

      const [broadcast] = await openBroadcasts()
      expect(broadcast).toMatchObject({
        title: 'Sunday Session',
        tagline: 'Deep cuts only',
        visibility: 'FAN_ONLY',
      })
      expect(await prisma.broadcastShowDraft.findUnique({ where: { channelId } })).toBeNull()

      const get = await getPreflight()
      expect(get.json()).toMatchObject({ session: 'PREVIEW', title: 'Sunday Session' })
    })

    it('starts the draft series’ next episode on connect, keeping the artist’s own title', async () => {
      await patch({ seriesId, title: 'Night Shift live from the attic' })

      await connect()

      const [broadcast] = await openBroadcasts()
      expect(broadcast!.scheduledLiveShowId).toBeTruthy()
      expect(broadcast!.episodeNumber).toBe(4)
      expect(broadcast!.title).toBe('Night Shift live from the attic')
      const get = await getPreflight()
      expect(get.json()).toMatchObject({ session: 'PREVIEW', seriesId })
    })
  })

  describe('per-broadcast cover', () => {
    it('falls back to the profile avatar until a cover is set', async () => {
      const before = await getPreflight()
      expect(before.json()).toMatchObject({ artworkUrl: null, coverUrl: AVATAR })

      const cover = publicMediaUrl(`media/${ARTIST}/cover123.png`)!
      const res = await patch({ artworkUrl: cover })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ artworkUrl: cover, coverUrl: cover })

      await connect()
      const [broadcast] = await openBroadcasts()
      expect(broadcast!.artworkUrl).toBe(cover)

      const cleared = await patch({ artworkUrl: null })
      expect(cleared.json()).toMatchObject({
        session: 'PREVIEW',
        artworkUrl: null,
        coverUrl: AVATAR,
      })
    })

    it('rejects a cover that is not the artist’s own upload', async () => {
      const elsewhere = await patch({ artworkUrl: 'https://images.example.test/cover.png' })
      expect(elsewhere.statusCode).toBe(400)
      const someoneElses = await patch({
        artworkUrl: publicMediaUrl('media/golive-fan/cover.png'),
      })
      expect(someoneElses.statusCode).toBe(400)
    })
  })

  describe('while LIVE', () => {
    it('only lets title, tagline and other unlocked fields change', async () => {
      await patch({ showType: 'LIVE_SET', visibility: 'PUBLIC' })
      await connect()
      expect((await goLive()).statusCode).toBe(200)

      for (const body of [{ visibility: 'PRIVATE' }, { showType: 'TALK' }, { seriesId }]) {
        const res = await patch(body)
        expect(res.statusCode).toBe(409)
        expect(res.json().error).toMatch(/can't change while you're live/)
      }

      const renamed = await patch({ title: 'Renamed mid-show', tagline: 'Now with guests' })
      expect(renamed.statusCode).toBe(200)
      expect(renamed.json()).toMatchObject({
        session: 'LIVE',
        title: 'Renamed mid-show',
        tagline: 'Now with guests',
      })

      const unchangedLocked = await patch({ showType: 'LIVE_SET', title: 'Autosave' })
      expect(unchangedLocked.statusCode).toBe(200)
    })

    it('still allows type and visibility changes during PREVIEW', async () => {
      await connect()
      const res = await patch({ showType: 'TALK', visibility: 'PRIVATE' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        session: 'PREVIEW',
        showType: 'TALK',
        visibility: 'PRIVATE',
      })
    })
  })

  describe('PRIVATE visibility', () => {
    async function goLivePrivately() {
      await patch({ visibility: 'PRIVATE' })
      await connect()
      expect((await goLive()).statusCode).toBe(200)
    }

    it('hides a PRIVATE live show from anonymous and fan viewers but not the artist', async () => {
      await goLivePrivately()

      const anonymous = await app.inject({ method: 'GET', url: `/api/channels/${ARTIST}` })
      expect(anonymous.json()).toMatchObject({ state: 'OFFLINE', hlsUrl: null, nowPlaying: null })

      const fan = await app.inject({
        method: 'GET',
        url: `/api/channels/${ARTIST}`,
        headers: { cookie: fanCookie },
      })
      expect(fan.json()).toMatchObject({ state: 'OFFLINE', hlsUrl: null })

      const owner = await app.inject({
        method: 'GET',
        url: `/api/channels/${ARTIST}`,
        headers: { cookie: artistCookie },
      })
      expect(owner.json().state).toBe('LIVE')
      expect(owner.json().hlsUrl).toBeTruthy()

      const list = await app.inject({ method: 'GET', url: '/api/v1/channels' })
      const liveSlugs = (list.json().live as Array<{ slug: string }>).map((c) => c.slug)
      expect(liveSlugs).not.toContain(ARTIST)

      const embed = await app.inject({ method: 'GET', url: `/api/v1/embed/c/${ARTIST}` })
      expect(embed.json()).toMatchObject({ state: 'OFFLINE', hlsUrl: null })
    })

    it('shows the same live show publicly once it is not PRIVATE', async () => {
      await patch({ visibility: 'PUBLIC' })
      await connect()
      await goLive()

      const anonymous = await app.inject({ method: 'GET', url: `/api/channels/${ARTIST}` })
      expect(anonymous.json().state).toBe('LIVE')
      expect(anonymous.json().hlsUrl).toBeTruthy()

      const list = await app.inject({ method: 'GET', url: '/api/v1/channels' })
      const liveSlugs = (list.json().live as Array<{ slug: string }>).map((c) => c.slug)
      expect(liveSlugs).toContain(ARTIST)
    })

    it('re-renders Liquidsoap without mirrors when a PRIVATE session starts on a mirrored channel', async () => {
      await prisma.rtmpTarget.create({
        data: {
          channelId,
          provider: 'YOUTUBE',
          label: 'Mirror',
          rtmpUrl: 'rtmp://mirror.example.test/live',
          streamKeyEnc: 'encrypted',
        },
      })
      await patch({ visibility: 'PRIVATE' })
      await connect()
      await vi.waitFor(() => expect(restartChannelLiquidsoap).toHaveBeenCalledTimes(1))
    })
  })

  describe('reconnecting', () => {
    it('holds a live show when the encoder drops and resumes it on reconnect', async () => {
      await connect()
      await goLive()
      expect((await signalStatus()).json()).toMatchObject({
        ingest: 'connected',
        reconnectDeadline: null,
      })

      const droppedAt = Date.now()
      await disconnect()

      const status = (await signalStatus()).json()
      expect(status.ingest).toBe('reconnecting')
      const deadline = new Date(status.reconnectDeadline).getTime()
      expect(deadline - droppedAt).toBeGreaterThanOrEqual(BROADCAST_RECONNECT_GRACE_MS - 1000)
      expect(deadline - droppedAt).toBeLessThanOrEqual(BROADCAST_RECONNECT_GRACE_MS + 5000)

      const me = await app.inject({
        method: 'GET',
        url: '/api/auth/me',
        headers: { cookie: artistCookie },
      })
      expect(me.json().channel).toMatchObject({ state: 'LIVE', ingest: 'reconnecting' })

      const [held] = await openBroadcasts()
      await connect()

      const after = await openBroadcasts()
      expect(after).toHaveLength(1)
      expect(after[0]!.id).toBe(held!.id)
      expect(after[0]!.ingestDisconnectedAt).toBeNull()
      expect((await signalStatus()).json().ingest).toBe('connected')
    })

    it('ends the show at the drop once the grace period runs out', async () => {
      await connect()
      await goLive()
      await disconnect()
      const [held] = await openBroadcasts()

      const ended = await endExpiredReconnectingBroadcasts(prisma, afterGrace())
      expect(ended.map((e) => e.broadcastId)).toEqual([held!.id])

      expect((await signalStatus()).json()).toMatchObject({
        ingest: 'disconnected',
        reconnectDeadline: null,
      })
      const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })
      expect(channel.state).toBe('OFFLINE')
    })

    it('starts a new session when the encoder comes back after the grace period', async () => {
      await connect()
      await goLive()
      await disconnect()
      const [held] = await openBroadcasts()
      await prisma.broadcast.update({
        where: { id: held!.id },
        data: { ingestDisconnectedAt: new Date(Date.now() - BROADCAST_RECONNECT_GRACE_MS - 1000) },
      })

      await connect()

      const old = await prisma.broadcast.findUniqueOrThrow({ where: { id: held!.id } })
      expect(old.endedAt).toBeTruthy()
      expect(enqueueFinalizeBroadcastRecording).toHaveBeenCalledWith(held!.id)
      const [fresh] = await openBroadcasts()
      expect(fresh!.id).not.toBe(held!.id)
      const channel = await prisma.channel.findUniqueOrThrow({ where: { id: channelId } })
      expect(channel.state).toBe('PREVIEW')
    })

    it('ends a preview-only session on disconnect without a reconnect hold', async () => {
      await connect()
      await disconnect()
      expect(await openBroadcasts()).toHaveLength(0)
      expect((await signalStatus()).json().ingest).toBe('disconnected')
    })
  })
})
