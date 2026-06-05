// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { collectBackupMetrics, renderBackupMetricLines } from './backup-metrics.js'

const send = vi.fn()

vi.mock('./minio.js', () => ({
  s3: { send: (...args: unknown[]) => send(...args) },
}))

describe('backup-metrics', () => {
  beforeEach(() => {
    send.mockReset()
  })

  it('returns age from the newest pg backup object', async () => {
    const twoHoursAgo = new Date(Date.now() - 2 * 3_600_000)
    send.mockResolvedValueOnce({
      Contents: [{ Key: 'pg/old.sql.gz', LastModified: new Date(Date.now() - 48 * 3_600_000) }],
      IsTruncated: true,
      NextContinuationToken: 'page2',
    })
    send.mockResolvedValueOnce({
      Contents: [{ Key: 'pg/new.sql.gz', LastModified: twoHoursAgo }],
      IsTruncated: false,
    })

    const snapshot = await collectBackupMetrics()
    expect(snapshot.postgresBackupAgeHours).not.toBeNull()
    expect(snapshot.postgresBackupAgeHours!).toBeGreaterThan(1.9)
    expect(snapshot.postgresBackupAgeHours!).toBeLessThan(2.1)
  })

  it('returns null when the backups bucket is empty', async () => {
    send.mockResolvedValueOnce({ Contents: [], IsTruncated: false })
    await expect(collectBackupMetrics()).resolves.toEqual({ postgresBackupAgeHours: null })
  })

  it('returns null when MinIO listing fails', async () => {
    send.mockRejectedValueOnce(new Error('access denied'))
    await expect(collectBackupMetrics()).resolves.toEqual({ postgresBackupAgeHours: null })
  })

  it('renders prometheus lines with -1 for unknown age', () => {
    const text = renderBackupMetricLines({ postgresBackupAgeHours: null }).join('\n')
    expect(text).toContain('tahti_postgres_backup_age_hours -1')
  })

  it('renders rounded age hours', () => {
    const text = renderBackupMetricLines({ postgresBackupAgeHours: 26.789 }).join('\n')
    expect(text).toContain('tahti_postgres_backup_age_hours 26.79')
  })
})
