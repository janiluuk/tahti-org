// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyRequest } from 'fastify'
import { config } from '../config.js'

/** RFC1918, loopback, and ULA — ingest callbacks run on the Docker network. */
const PRIVATE_IP =
  /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.|::1$|::ffff:127\.|::ffff:10\.|::ffff:192\.168\.|fd)/

export function isTrustedInternalRequest(request: FastifyRequest): boolean {
  const auth = request.headers.authorization
  if (auth === `Bearer ${config.internalSecret}`) return true
  const ip = request.ip ?? ''
  return PRIVATE_IP.test(ip)
}
