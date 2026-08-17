// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { nanoid } from 'nanoid'

export function generateSessionId(): string {
  return nanoid(40)
}

export function generateVerificationToken(): string {
  return nanoid(32)
}

export function sessionExpiresAt(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 30)
  return d
}

export function verificationExpiresAt(): Date {
  const d = new Date()
  d.setHours(d.getHours() + 24)
  return d
}

export function passwordSetupExpiresAt(): Date {
  const d = new Date()
  d.setDate(d.getDate() + 7)
  return d
}

/** Shorter than the invite-setup expiry: this token can take over an
 * already-active account, so it needs a tighter window. */
export function passwordResetExpiresAt(): Date {
  const d = new Date()
  d.setHours(d.getHours() + 1)
  return d
}

export function generateTotpChallengeId(): string {
  return nanoid(40)
}

export function totpChallengeExpiresAt(): Date {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 10)
  return d
}
