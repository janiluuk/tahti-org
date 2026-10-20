// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyReply } from 'fastify'
import { config } from '../../config.js'

export function setRefreshCookie(reply: FastifyReply, token: string): void {
  reply.setCookie(config.refreshCookieName, token, {
    httpOnly: true,
    secure: config.isProd,
    sameSite: 'lax',
    maxAge: config.refreshTokenTtlSec,
    path: config.refreshCookiePath,
    domain: config.sessionCookieDomain,
  })
}

export function clearRefreshCookie(reply: FastifyReply): void {
  reply.clearCookie(config.refreshCookieName, {
    path: config.refreshCookiePath,
    domain: config.sessionCookieDomain,
  })
}
