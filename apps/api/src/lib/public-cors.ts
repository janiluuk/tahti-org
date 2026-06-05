// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyReply, FastifyRequest } from 'fastify'

const PUBLIC_FORM_ORIGINS = new Set([
  'https://tahti.live',
  'https://www.tahti.live',
  'https://app.tahti.live',
  'http://localhost:3000',
  'http://localhost:3010',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3010',
])

/** CORS for public form POSTs from the marketing site and app origin. */
export function applyPublicFormCors(request: FastifyRequest, reply: FastifyReply): void {
  const origin = request.headers.origin
  if (origin && PUBLIC_FORM_ORIGINS.has(origin)) {
    reply.header('Access-Control-Allow-Origin', origin)
    reply.header('Access-Control-Allow-Credentials', 'true')
    reply.header('Vary', 'Origin')
  }
}
