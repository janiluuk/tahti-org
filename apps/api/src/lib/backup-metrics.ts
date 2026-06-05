// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { ListObjectsV2Command } from '@aws-sdk/client-s3'
import { config } from '../config.js'
import { s3 } from './minio.js'

export interface BackupMetricSnapshot {
  /** Hours since newest pg backup; null when listing fails or bucket is empty. */
  postgresBackupAgeHours: number | null
}

export async function collectBackupMetrics(): Promise<BackupMetricSnapshot> {
  const bucket = config.minio.backupsBucket
  const prefix = config.minio.backupsPgPrefix

  try {
    let latest: Date | null = null
    let token: string | undefined

    do {
      const res = await s3.send(
        new ListObjectsV2Command({
          Bucket: bucket,
          Prefix: prefix,
          ContinuationToken: token,
        }),
      )
      for (const obj of res.Contents ?? []) {
        if (obj.LastModified && (!latest || obj.LastModified > latest)) {
          latest = obj.LastModified
        }
      }
      token = res.IsTruncated ? res.NextContinuationToken : undefined
    } while (token)

    if (!latest) return { postgresBackupAgeHours: null }

    const ageHours = (Date.now() - latest.getTime()) / 3_600_000
    return { postgresBackupAgeHours: ageHours }
  } catch {
    return { postgresBackupAgeHours: null }
  }
}

export function renderBackupMetricLines(snapshot: BackupMetricSnapshot): string[] {
  const age = snapshot.postgresBackupAgeHours
  const value = age === null ? -1 : Math.round(age * 100) / 100
  return [
    '# HELP tahti_postgres_backup_age_hours Hours since the newest Postgres backup object in MinIO. -1 when unknown.',
    '# TYPE tahti_postgres_backup_age_hours gauge',
    `tahti_postgres_backup_age_hours ${value}`,
  ]
}
