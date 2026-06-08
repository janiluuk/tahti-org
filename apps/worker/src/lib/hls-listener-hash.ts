// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { createHash } from 'node:crypto'

function internalSecret(): string {
  return process.env.INTERNAL_SECRET ?? 'dev-internal-secret-change-in-prod'
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex')
}

/**
 * Anonymized, non-reversible, daily-rotating listener identifier for distinct-listener
 * counting from HLS access logs (mirrors the download-fraud `dailySalt`+`sha256(ip:salt)`
 * pattern in apps/api/src/routes/downloads/archive.ts). The salt rotates per UTC day so
 * the same listener cannot be tracked across days, only counted within one.
 */
export function hashHlsListenerId(clientIp: string, utcDate: string): string {
  const salt = sha256(`${internalSecret()}:${utcDate}`)
  return sha256(`${clientIp}:${salt}`)
}
