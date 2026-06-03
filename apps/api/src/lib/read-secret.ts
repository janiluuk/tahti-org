// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readFileSync } from 'node:fs'

/** PLAT-005: read credential from env or Docker secret file (`*_FILE`). */
export function readSecret(envKey: string, fileKey: string, fallback: string): string {
  const path = process.env[fileKey]
  if (path) {
    try {
      return readFileSync(path, 'utf8').trim()
    } catch {
      // fall through to env/default
    }
  }
  return process.env[envKey] ?? fallback
}
