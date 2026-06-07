// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Browser CORS for the API origin (api.tahti.live), called cross-origin from
// the artist app (app.tahti.live), per-channel pages (*.tahti.live), and the
// marketing site (tahti.live). Without this, every credentialed fetch() from
// those origins is blocked by the browser — Caddy's @cors header only covers
// OPTIONS preflights, not the actual GET/POST/etc. responses.

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { config } from '../config.js'

const ALLOWED_METHODS = 'GET, POST, PUT, PATCH, DELETE, OPTIONS'
const ALLOWED_HEADERS = 'Content-Type, Authorization'

function isAllowedOrigin(origin: string): boolean {
  let url: URL
  try {
    url = new URL(origin)
  } catch {
    return false
  }

  if (origin === config.appUrl) return true

  if (
    url.protocol === 'https:' &&
    (url.hostname === 'tahti.live' || url.hostname.endsWith('.tahti.live'))
  ) {
    return true
  }

  // Local/dev/e2e stacks publish web and api on different localhost ports —
  // those are cross-origin too, so allow them outside production.
  if (!config.isProd && (url.hostname === 'localhost' || url.hostname === '127.0.0.1')) {
    return true
  }

  return false
}

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
