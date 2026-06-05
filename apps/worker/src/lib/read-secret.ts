// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { readFileSync } from 'node:fs'

export function readSecret(envKey: string, fileKey: string): string | undefined {
  const fromEnv = process.env[envKey]?.trim()
  if (fromEnv) return fromEnv
  const path = process.env[fileKey]?.trim()
  if (!path) return undefined
  try {
    return readFileSync(path, 'utf8').trim() || undefined
  } catch {
    return undefined
  }
}
