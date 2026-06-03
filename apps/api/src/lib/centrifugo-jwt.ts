// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { createHmac } from 'node:crypto'
import { config } from '../config.js'

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

export function signCentrifugoToken(payload: Record<string, unknown>, ttlSec = 3600): string {
  const now = Math.floor(Date.now() / 1000)
  const claims = { ...payload, exp: now + ttlSec }

  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }))
  const body = base64url(JSON.stringify(claims))
  const sig = createHmac('sha256', config.centrifugo.jwtSecret).update(`${header}.${body}`).digest()

  return `${header}.${body}.${base64url(sig)}`
}
