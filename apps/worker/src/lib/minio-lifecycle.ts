// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { PutBucketLifecycleConfigurationCommand } from '@aws-sdk/client-s3'
import { s3 } from './minio.js'

/** Mirrors scripts/init-minio-buckets.sh's `mc ilm add` rules, but applied by
 * code on every cron-runner startup instead of a manual one-off script — the
 * manual step was never run against production: confirmed live, hls-live had
 * accumulated 3.7M objects / ~600GB over 6 weeks with zero expiry, filling
 * the host disk to 92%. Idempotent: re-applying the same rule is a no-op. */
const BUCKET_EXPIRY_DAYS: Record<string, number> = {
  'hls-live': 1,
  recordings: 7,
  backups: 90,
  // audio, covers: no expiry — artist/listener-facing content lives as long
  // as the artist is active.
}

export async function ensureBucketLifecycles(): Promise<void> {
  for (const [bucket, expiryDays] of Object.entries(BUCKET_EXPIRY_DAYS)) {
    try {
      await s3.send(
        new PutBucketLifecycleConfigurationCommand({
          Bucket: bucket,
          LifecycleConfiguration: {
            Rules: [
              {
                ID: `${bucket}-expiry-${expiryDays}d`,
                Status: 'Enabled',
                Filter: { Prefix: '' },
                Expiration: { Days: expiryDays },
              },
            ],
          },
        }),
      )
      console.log(`[minio-lifecycle] ${bucket}: expiry set to ${expiryDays}d`)
    } catch (err) {
      // A bucket that doesn't exist yet (fresh env, buckets not bootstrapped)
      // shouldn't crash cron registration — log and move on.
      console.error(`[minio-lifecycle] failed to set lifecycle for ${bucket}:`, err)
    }
  }
}
