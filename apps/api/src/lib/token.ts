// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

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
