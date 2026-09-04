// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyRequest } from 'fastify'
import { config } from '../config.js'

// SEC-014: this used to also match 192.168.0.0/16. That range is NOT
// docker-network-only here — vimage's public-facing reverse proxy (NPM, on
// a separate host, pi4) reaches the API over that same home LAN, and Caddy's
// on-demand-TLS "ask" caller (infra/Caddyfile) does too. Any request routed
// through that proxy — i.e. every public request to api.tahti.live — was
// therefore indistinguishable from a genuine internal call, regardless of
// Authorization headers or X-Forwarded-For: confirmed live, an unauthenticated
// `GET /internal/tls-ask` from the public internet returned 200. The
// tahti-stack docker-compose network (where Icecast/nginx-rtmp/Centrifugo/
// worker actually run) is 172.28.0.0/16, covered below without 192.168.x.x.
// Genuinely-remote callers outside that subnet (e.g. the not-yet-active
// vimage4/vimage7 Liquidsoap worker scaffold in
// infra/docker-compose.liquidsoap-remote.yml, which also lives on the
// 192.168.2.0/24 home LAN) are expected to authenticate with
// INTERNAL_SECRET instead — see infra/stack.env.liquidsoap-remote.example,
// which already provisions it for exactly this reason.
const PRIVATE_IP = /^(127\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.|::1$|::ffff:127\.|::ffff:10\.|fd)/

/** Matches `Bearer {internalSecret}` (every caller that can set custom
 * headers) or a `?secret=` query param — Icecast's URL-auth callbacks,
 * nginx-rtmp's on_publish/on_done/on_update, and Caddy's on-demand-TLS "ask"
 * hook have no way to attach a header, only a URL (the same reason
 * routes/internal/channel-fallback.ts already does its own version of this
 * for Liquidsoap). */
function hasValidInternalSecret(request: FastifyRequest): boolean {
  const auth = request.headers.authorization
  if (auth === `Bearer ${config.internalSecret}`) return true
  const query = request.query as Record<string, unknown> | undefined
  const secretParam = query?.secret
  return typeof secretParam === 'string' && secretParam === config.internalSecret
}

export function isTrustedInternalRequest(request: FastifyRequest): boolean {
  if (hasValidInternalSecret(request)) return true
  const ip = request.ip ?? ''
  return PRIVATE_IP.test(ip)
}
