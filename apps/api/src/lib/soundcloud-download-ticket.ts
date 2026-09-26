// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Signed, expiring download links for one SoundCloud track of one user. The
// desktop app downloads with a plain HTTP client that has no Tahti session, so
// the link itself carries the authorisation; the SoundCloud OAuth token stays
// on the server.

import { createHmac, timingSafeEqual } from 'node:crypto'
import { config } from '../config.js'

/** Long enough for a large set to download at three tracks at a time. */
export const SOUNDCLOUD_TICKET_TTL_MS = 12 * 60 * 60 * 1000

interface TicketPayload {
  u: string
  t: string
  e: number
}

export type TicketCheck =
  { ok: true; userId: string; trackId: string } | { ok: false; reason: 'invalid' | 'expired' }

function signingKey(): Buffer {
  // Derived rather than the session secret itself, so a ticket signature can
  // never double as anything signed with the session secret.
  return createHmac('sha256', config.sessionSecret).update('soundcloud-download-ticket/v1').digest()
}

function sign(body: string): string {
  return createHmac('sha256', signingKey()).update(body).digest('base64url')
}

export function createSoundcloudTicket(
  userId: string,
  trackId: string,
  now = Date.now(),
): { ticket: string; expiresAt: Date } {
  const expires = now + SOUNDCLOUD_TICKET_TTL_MS
  const payload: TicketPayload = { u: userId, t: trackId, e: expires }
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return { ticket: `${body}.${sign(body)}`, expiresAt: new Date(expires) }
}

export function verifySoundcloudTicket(ticket: string, now = Date.now()): TicketCheck {
  const [body, signature, extra] = ticket.split('.')
  if (!body || !signature || extra !== undefined) return { ok: false, reason: 'invalid' }
  const expected = Buffer.from(sign(body))
  const given = Buffer.from(signature)
  if (expected.length !== given.length || !timingSafeEqual(expected, given)) {
    return { ok: false, reason: 'invalid' }
  }
  let payload: Partial<TicketPayload>
  try {
    payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8')) as Partial<TicketPayload>
  } catch {
    return { ok: false, reason: 'invalid' }
  }
  if (
    typeof payload.u !== 'string' ||
    typeof payload.t !== 'string' ||
    typeof payload.e !== 'number'
  ) {
    return { ok: false, reason: 'invalid' }
  }
  if (payload.e <= now) return { ok: false, reason: 'expired' }
  return { ok: true, userId: payload.u, trackId: payload.t }
}

export function soundcloudTicketUrl(trackId: string, ticket: string): string {
  return `${config.apiUrl}/api/v1/imports/soundcloud/tracks/${encodeURIComponent(trackId)}/download?ticket=${ticket}`
}
