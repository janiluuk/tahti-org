// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import {
  FingerprintResultSchema,
  IdParamSchema,
  MeReleaseTrackDownloadQuerySchema,
  ReleaseTrackCreditsPatchSchema,
  ReleaseTrackDownloadUrlSchema,
  ReleaseTrackFinalizeSchema,
  ReleaseTrackInputSchema,
  ReleaseTrackParamsSchema,
  ReleaseTrackUploadSchema,
  ReleaseTrackUploadUrlSchema,
  ReleaseTrackViewSchema,
  openApiResponse,
  openApiResponses,
  parseRouteParams,
} from '@tahti/shared'
import { nanoid } from 'nanoid'
import { restrictionErrorMessage } from '@tahti/db'
import { requireAuth } from '../../plugins/auth.js'
import { presignedPutUrl, presignedGetUrl } from '../../lib/minio.js'
import { mediaQueue, runFingerprintReleaseTrack } from '../../lib/queue.js'

const PRESIGN_TTL_SEC = 900
const ACCEPTED_FORMATS = ['audio/wav', 'audio/flac', 'audio/mpeg', 'audio/aac', 'audio/x-aiff']

const releaseTrackRoutes: FastifyPluginAsync = async (fastify) => {
  // POST /api/me/releases/:id/tracks — add a metadata-only track (no file)
  fastify.post(
    '/api/me/releases/:id/tracks',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponses([
          { status: 201, schema: ReleaseTrackViewSchema, name: 'ReleaseTrackView' },
        ]),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(IdParamSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const releaseId = routeParams.id
      const parsed = ReleaseTrackInputSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const body = parsed.data

      const release = await fastify.prisma.release.findFirst({
        where: { id: releaseId, userId: user.id },
        include: { _count: { select: { tracks: true } } },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const position = release._count.tracks + 1

      const track = await fastify.prisma.releaseTrack.create({
        data: {
          releaseId,
          position,
          title: body.title,
          durationSec: body.durationSec ?? null,
          soundId: body.soundId ?? null,
          isrc: body.isrc ?? null,
          explicit: body.explicit ?? false,
          genre: body.genre ?? release.genre,
          genreCustom: body.genre ? (body.genreCustom ?? null) : release.genreCustom,
          subGenres: body.subGenres ?? [],
          tags: body.tags ?? [],
          bpm: body.bpm ?? null,
          musicalKey: body.musicalKey ?? null,
          mixVersion: body.mixVersion ?? null,
          status: 'PENDING',
        },
      })

      return reply.status(201).send(track)
    },
  )

  // POST /api/me/releases/:id/tracks/:trackId/upload — presigned URL for source audio
  fastify.post(
    '/api/me/releases/:id/tracks/:trackId/upload',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(ReleaseTrackUploadUrlSchema, 'ReleaseTrackUploadUrl'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseTrackParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id: releaseId, trackId } = routeParams
      const parsed = ReleaseTrackUploadSchema.safeParse(request.body ?? {})
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }
      const body = parsed.data

      const uploadBanError = await restrictionErrorMessage(fastify.prisma, user.id, 'UPLOAD')
      if (uploadBanError) return reply.status(403).send({ error: uploadBanError })

      const release = await fastify.prisma.release.findFirst({
        where: { id: releaseId, userId: user.id },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const track = await fastify.prisma.releaseTrack.findFirst({
        where: { id: trackId, releaseId },
      })
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      const contentType = body.contentType ?? 'audio/mpeg'
      if (!ACCEPTED_FORMATS.includes(contentType)) {
        return reply.status(400).send({
          error: `Unsupported format. Accepted: ${ACCEPTED_FORMATS.join(', ')}`,
        })
      }

      const ext = (body.filename ?? 'audio').split('.').pop() ?? 'mp3'
      const key = `releases/${user.username}/${releaseId}/${trackId}-${nanoid(8)}.${ext}`

      const uploadUrl = await presignedPutUrl(key, contentType, PRESIGN_TTL_SEC)
      const expiresAt = new Date(Date.now() + PRESIGN_TTL_SEC * 1000).toISOString()

      await fastify.prisma.releaseTrack.update({
        where: { id: trackId },
        data: { sourceKey: key, status: 'PENDING' },
      })

      return reply.send({ uploadUrl, sourceKey: key, expiresAt })
    },
  )

  // POST /api/me/releases/:id/tracks/:trackId/finalize — trigger transcode after upload
  fastify.post(
    '/api/me/releases/:id/tracks/:trackId/finalize',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(ReleaseTrackFinalizeSchema, 'ReleaseTrackFinalize') },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseTrackParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id: releaseId, trackId } = routeParams

      const release = await fastify.prisma.release.findFirst({
        where: { id: releaseId, userId: user.id },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const track = await fastify.prisma.releaseTrack.findFirst({
        where: { id: trackId, releaseId },
      })
      if (!track) return reply.status(404).send({ error: 'Track not found' })
      if (!track.sourceKey) return reply.status(400).send({ error: 'No source file uploaded' })

      await fastify.prisma.releaseTrack.update({
        where: { id: trackId },
        data: { status: 'SCANNING' },
      })

      await mediaQueue.add('transcode-release-track', { trackId })

      return reply.send({ trackId, status: 'scanning' })
    },
  )

  type OwnedReadyTrackResult = { ok: false; error: string; status: number } | { ok: true }

  async function ownedReadyTrack(
    userId: string,
    releaseId: string,
    trackId: string,
  ): Promise<OwnedReadyTrackResult> {
    const release = await fastify.prisma.release.findFirst({
      where: { id: releaseId, userId },
    })
    if (!release) return { ok: false, error: 'Release not found', status: 404 }

    const track = await fastify.prisma.releaseTrack.findFirst({
      where: { id: trackId, releaseId },
    })
    if (!track) return { ok: false, error: 'Track not found', status: 404 }
    if (!track.sourceKey) {
      return { ok: false, error: 'No source audio uploaded for this track', status: 400 }
    }
    if (track.status !== 'READY') {
      return { ok: false, error: 'Track is still processing — try again shortly', status: 409 }
    }
    return { ok: true }
  }

  // POST /api/me/releases/:id/tracks/:trackId/fingerprint — re-run the
  // Chromaprint fingerprint + AcoustID lookup and store the result, same
  // computation the upload pipeline already runs automatically once.
  fastify.post(
    '/api/me/releases/:id/tracks/:trackId/fingerprint',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(FingerprintResultSchema, 'FingerprintResult') },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseTrackParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id: releaseId, trackId } = routeParams

      const owned = await ownedReadyTrack(user.id, releaseId, trackId)
      if (!owned.ok) return reply.status(owned.status).send({ error: owned.error })

      try {
        const result = await runFingerprintReleaseTrack(trackId, true)
        return reply.send(result)
      } catch {
        return reply
          .status(503)
          .send({ error: 'Fingerprinting is taking longer than expected — try again shortly' })
      }
    },
  )

  // POST /api/me/releases/:id/tracks/:trackId/fingerprint/check — same
  // computation, but never writes `fingerprint`/`fingerprintMatch` — a
  // preview for a listener who wants to see a candidate match without
  // replacing whatever's already stored.
  fastify.post(
    '/api/me/releases/:id/tracks/:trackId/fingerprint/check',
    {
      preHandler: requireAuth,
      schema: { response: openApiResponse(FingerprintResultSchema, 'FingerprintResult') },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseTrackParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id: releaseId, trackId } = routeParams

      const owned = await ownedReadyTrack(user.id, releaseId, trackId)
      if (!owned.ok) return reply.status(owned.status).send({ error: owned.error })

      try {
        const result = await runFingerprintReleaseTrack(trackId, false)
        return reply.send(result)
      } catch {
        return reply
          .status(503)
          .send({ error: 'Fingerprinting is taking longer than expected — try again shortly' })
      }
    },
  )

  // PATCH /api/me/releases/:id/tracks/:trackId/credits — per-song credits (vocals, guitars, ...)
  fastify.patch(
    '/api/me/releases/:id/tracks/:trackId/credits',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(ReleaseTrackViewSchema, 'ReleaseTrackView'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseTrackParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id: releaseId, trackId } = routeParams
      const parsed = ReleaseTrackCreditsPatchSchema.safeParse(request.body)
      if (!parsed.success) {
        return reply
          .status(400)
          .send({ error: parsed.error.issues[0]?.message ?? 'Invalid request body' })
      }

      const release = await fastify.prisma.release.findFirst({
        where: { id: releaseId, userId: user.id },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const track = await fastify.prisma.releaseTrack.findFirst({
        where: { id: trackId, releaseId },
      })
      if (!track) return reply.status(404).send({ error: 'Track not found' })

      const credits =
        parsed.data.credits && parsed.data.credits.length > 0
          ? parsed.data.credits.map((c) => ({
              role: c.role.trim(),
              name: c.name.trim(),
              ...(c.artistUsername ? { artistUsername: c.artistUsername } : {}),
            }))
          : null

      const data: Record<string, unknown> = { credits }
      const updated = await fastify.prisma.releaseTrack.update({
        where: { id: trackId },
        data,
      })

      return reply.send(updated)
    },
  )

  // GET /api/me/releases/:id/tracks/:trackId/download — signed download URL (Studio tier)
  fastify.get(
    '/api/me/releases/:id/tracks/:trackId/download',
    {
      preHandler: requireAuth,
      schema: {
        response: openApiResponse(ReleaseTrackDownloadUrlSchema, 'ReleaseTrackDownloadUrl'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!
      const routeParams = parseRouteParams(ReleaseTrackParamsSchema, request.params)
      if (!routeParams) return reply.status(400).send({ error: 'Invalid path parameters' })
      const { id: releaseId, trackId } = routeParams
      const parsedQuery = MeReleaseTrackDownloadQuerySchema.safeParse(request.query)
      if (!parsedQuery.success) {
        return reply.status(400).send({
          error: parsedQuery.error.issues[0]?.message ?? 'Invalid query',
        })
      }

      const release = await fastify.prisma.release.findFirst({
        where: { id: releaseId, userId: user.id },
      })
      if (!release) return reply.status(404).send({ error: 'Release not found' })

      const track = await fastify.prisma.releaseTrack.findFirst({
        where: { id: trackId, releaseId },
      })
      if (!track) return reply.status(404).send({ error: 'Track not found' })
      if (track.status !== 'READY') {
        return reply.status(409).send({ error: 'Track not ready yet' })
      }

      const wantFlac = parsedQuery.data.format === 'flac'
      if (wantFlac && user.tier === 'FREE') {
        return reply
          .status(403)
          .send({ error: 'FLAC download requires membership or fan subscription' })
      }

      const key = wantFlac
        ? (track.flacKey ?? track.sourceKey)
        : (track.streamKey ?? track.sourceKey)
      if (!key) return reply.status(404).send({ error: 'Download not available' })

      const url = await presignedGetUrl(key, 300)
      return reply.send({ url, format: wantFlac ? 'flac' : 'opus', expiresInSec: 300 })
    },
  )
}

export default releaseTrackRoutes
