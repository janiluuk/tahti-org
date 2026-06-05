// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { verifyPassword } from './password.js'

/** ARTIST-002: previous ingest credentials stay valid this long after hot rotation. */
export const HOT_INGEST_ROTATE_GRACE_MS = 24 * 60 * 60 * 1000

type PreviousCredential = {
  previousHash: string | null
  previousExpiresAt: Date | null
}

export async function verifyRtmpStreamName(
  currentHash: string,
  previous: PreviousCredential,
  streamName: string,
): Promise<boolean> {
  if (await verifyPassword(currentHash, streamName)) return true
  return verifyPreviousCredential(previous, streamName)
}

export async function verifyIcecastSourcePass(
  currentHash: string,
  previous: PreviousCredential,
  pass: string,
): Promise<boolean> {
  if (await verifyPassword(currentHash, pass)) return true
  return verifyPreviousCredential(previous, pass)
}

async function verifyPreviousCredential(
  previous: PreviousCredential,
  secret: string,
): Promise<boolean> {
  if (!previous.previousHash || !previous.previousExpiresAt) return false
  if (previous.previousExpiresAt.getTime() <= Date.now()) return false
  return verifyPassword(previous.previousHash, secret)
}

export function hotRotatePreviousFields(currentHash: string): {
  previousHash: string
  previousExpiresAt: Date
} {
  return {
    previousHash: currentHash,
    previousExpiresAt: new Date(Date.now() + HOT_INGEST_ROTATE_GRACE_MS),
  }
}

export function clearHotRotatePreviousFields(): {
  previousHash: null
  previousExpiresAt: null
} {
  return { previousHash: null, previousExpiresAt: null }
}
