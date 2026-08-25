// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { statfs } from 'node:fs/promises'
import { config } from '../config.js'

export interface HostDiskSpace {
  totalBytes: number
  freeBytes: number
  usedBytes: number
}

/** Ground-truth local disk usage for the admin storage panel — statfs on the volume
 * backing MinIO's hot cache (see config.storageDiskPath). Node's statfs exposes the
 * same fields `df` reads: `bavail` (free to an unprivileged process, what we report
 * as "free") vs `bfree` (free including reserved blocks root can dip into) — using
 * `bavail` keeps this consistent with what an operator would see running `df -h`. */
export async function getHostDiskSpace(
  path: string = config.storageDiskPath,
): Promise<HostDiskSpace | null> {
  try {
    const stats = await statfs(path)
    const totalBytes = stats.blocks * stats.bsize
    const freeBytes = stats.bavail * stats.bsize
    const usedBytes = totalBytes - stats.bfree * stats.bsize
    return { totalBytes, freeBytes, usedBytes }
  } catch {
    return null
  }
}
