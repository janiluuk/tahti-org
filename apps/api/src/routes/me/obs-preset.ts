// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import { ObsPresetResponseSchema, openApiResponse } from '@tahti/shared'
import { requireAuth } from '../../plugins/auth.js'
import { config } from '../../config.js'
import { parseIngestHostList, resolveRtmpIngestHosts } from '../../lib/ingest-endpoints.js'

/** Matches the values already documented in docs/obs-and-broadcasting-guides.md. */
const RECOMMENDED_SETTINGS = {
  audioCodec: 'AAC',
  audioBitrateKbps: 128,
  sampleRateHz: 44100,
  channels: 'Stereo',
  videoCodec: 'x264',
  videoBitrateKbps: 2500,
  keyframeIntervalSec: 2,
  preset: 'veryfast',
  profile: 'main',
  tune: 'zerolatency',
}

/**
 * Builds a real OBS Scene Collection JSON (Scene Collection → Import in OBS) with the
 * artist's cover art + display name pre-wired as an Image + Text source. This is a
 * local-OBS convenience only: Tahti's own ingest strips video at the edge encoder
 * (services/orchestrator/src/edge-encoder.ts), so this composed scene never reaches
 * Tahti or the YouTube/Twitch multistream mirror — that mirror bakes its own video
 * track server-side (see services/orchestrator/src/cover-cache.ts).
 */
function buildSceneCollection(sceneName: string, avatarUrl: string | null, title: string) {
  const sources: Record<string, unknown>[] = []
  const items: Record<string, unknown>[] = []

  if (avatarUrl) {
    sources.push({
      id: 'image_source',
      name: 'Cover Art',
      versioned_id: 'image_source',
      settings: { file: avatarUrl },
      mixers: 0,
      sync: 0,
      hotkeys: {},
      flags: 0,
    })
    items.push({
      name: 'Cover Art',
      visible: true,
      pos: { x: 0, y: 0 },
      scale: { x: 1, y: 1 },
      align: 5,
      bounds_type: 2,
      bounds: { x: 1920, y: 1080 },
      bounds_align: 0,
    })
  }

  sources.push({
    id: 'text_gdiplus_v2',
    name: 'Title',
    // OBS's built-in text source ID differs per OS (Windows: text_gdiplus_v2, used
    // here since that's the most common OBS platform; macOS/Linux: text_ft2_source_v2
    // — if this source doesn't appear after import, re-add it as "Text (FreeType 2)").
    versioned_id: 'text_gdiplus_v2',
    settings: {
      text: title,
      color: 4294967295,
      font: { face: 'Arial', size: 48, flags: 0 },
    },
    mixers: 0,
    sync: 0,
    hotkeys: {},
    flags: 0,
  })
  items.push({
    name: 'Title',
    visible: true,
    pos: { x: 40, y: 960 },
    scale: { x: 1, y: 1 },
    align: 5,
  })

  sources.push({
    id: 'scene',
    name: sceneName,
    settings: { items },
    mixers: 0,
    sync: 0,
    hotkeys: {},
    flags: 0,
  })

  return {
    current_scene: sceneName,
    current_program_scene: sceneName,
    scene_order: [{ name: sceneName }],
    name: sceneName,
    sources,
    quick_transitions: [],
    transitions: [],
    saved_projectors: [],
    current_transition: 'Fade',
    transition_duration: 300,
    preview_locked: false,
    modules: {},
  }
}

const obsPresetRoutes: FastifyPluginAsync = async (fastify) => {
  // GET /api/me/obs-preset — RTMP server/key, recommended encoder settings, and a
  // downloadable OBS scene collection with cover art + title pre-wired.
  fastify.get(
    '/api/me/obs-preset',
    {
      preHandler: requireAuth,
      schema: {
        tags: ['channel'],
        description: 'Downloadable OBS setup: RTMP server/key, recommended settings, scene JSON',
        response: openApiResponse(ObsPresetResponseSchema, 'ObsPreset'),
      },
    },
    async (request, reply) => {
      const user = request.sessionUser!

      const channel = await fastify.prisma.channel.findUnique({
        where: { userId: user.id },
        select: { slug: true, rtmpStreamKey: true },
      })
      if (!channel) return reply.status(404).send({ error: 'Channel not found' })

      const rtmpHosts = parseIngestHostList(config.rtmpIngestHosts, config.rtmpIngestHost)
      const rtmp = await resolveRtmpIngestHosts({
        hosts: rtmpHosts,
        healthPort: config.rtmpIngestHealthPort,
        healthPath: config.rtmpIngestHealthPath,
        healthScheme: config.rtmpIngestHealthScheme,
      })

      const sceneName = `Tahti — ${channel.slug}`
      const sceneCollection = buildSceneCollection(sceneName, user.avatarUrl ?? null, user.displayName)

      return reply.send({
        server: rtmp.server,
        streamKey: channel.rtmpStreamKey,
        recommended: RECOMMENDED_SETTINGS,
        sceneCollection,
        sceneCollectionFilename: `tahti-${channel.slug}-scene.json`,
      })
    },
  )
}

export default obsPresetRoutes
