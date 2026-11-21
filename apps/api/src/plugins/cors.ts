// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Browser CORS for the API origin (api.tahti.live), called cross-origin from
// the artist app (app.tahti.live), per-channel pages (*.tahti.live), and the
// marketing site (tahti.live). Without this, every credentialed fetch() from
// those origins is blocked by the browser — Caddy's @cors header only covers
// OPTIONS preflights, not the actual GET/POST/etc. responses.

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { isAllowedOrigin } from '../lib/allowed-origin.js'

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization'

const corsPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const origin = request.headers.origin
    if (!origin || !isAllowedOrigin(origin)) return

    reply.header('Access-Control-Allow-Origin', origin)
    reply.header('Access-Control-Allow-Credentials', 'true')
    reply.header('Vary', 'Origin')

    if (request.method === 'OPTIONS') {
      reply
        .header('Access-Control-Allow-Methods', ALLOWED_METHODS)
        .header('Access-Control-Allow-Headers', ALLOWED_HEADERS)
        .code(204)
        .send()
    }
  })
}

export default fp(corsPlugin, { name: 'cors' })
