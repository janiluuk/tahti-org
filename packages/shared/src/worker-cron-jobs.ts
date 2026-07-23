// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Repeatable BullMQ cron jobs — single manifest for worker, API admin, and runbooks.
 * Most jobs use a standard cron `pattern` (minute granularity at best). A job that
 * genuinely needs sub-minute cadence sets `everyMs` instead — BullMQ's `repeat.every`
 * accepts a millisecond interval directly, bypassing cron's one-minute floor. */
export interface CronJobSpec {
  name: string
  pattern?: string
  everyMs?: number
  jobId: string
  description: string
}

export const WORKER_CRON_JOBS: CronJobSpec[] = [
  {
    name: 'monthly-ledger-rollup',
    pattern: '0 2 2 * *',
    jobId: 'monthly-ledger-rollup-cron',
    description: 'Monthly ledger rollup (2nd of month, 02:00 UTC)',
  },
  {
    name: 'annual-grant-calc',
    pattern: '0 3 1 3 *',
    jobId: 'annual-grant-calc-cron',
    description: 'Annual grant calculation (1 March, 03:00 UTC)',
  },
  {
    name: 'broadcast-cap-tick',
    pattern: '* * * * *',
    jobId: 'broadcast-cap-tick-cron',
    description: 'M20: free-tier live cap tick every minute',
  },
  {
    name: 'channel-watchdog',
    pattern: '* * * * *',
    jobId: 'channel-watchdog-cron',
    description: 'STREAM-005: restart Liquidsoap when HLS segments are stale',
  },
  {
    name: 'radio-slot-switchover',
    pattern: '* * * * *',
    jobId: 'radio-slot-switchover-cron',
    description: 'Switch Tahti Radio to a booked artist live source at slot boundaries',
  },
  {
    name: 'hls-minio-sync',
    // A once-a-minute cadence left the public manifest (a ~16s sliding window —
    // segments=4 × segment_duration=4s in the Liquidsoap template) fully stale
    // and fully consumed for ~44 of every 60 seconds: confirmed live in
    // production by polling the manifest's Last-Modified header, which only
    // advanced exactly once per minute, causing every listener to hit dead air
    // for the majority of each cycle. 4s matches the segment cadence so the
    // manifest never runs dry between syncs.
    everyMs: 4000,
    jobId: 'hls-minio-sync-cron',
    description: 'STREAM-001: mirror live HLS segments from volume to MinIO hls-live bucket',
  },
  {
    name: 'hls-caddy-egress-sync',
    pattern: '* * * * *',
    jobId: 'hls-caddy-egress-sync-cron',
    description: 'STREAM-006: aggregate Caddy HLS access log bytes into Redis (edge worker only)',
  },
  {
    name: 'archive-fallback-cache-sync',
    pattern: '*/10 * * * *',
    jobId: 'archive-fallback-cache-sync-cron',
    description: 'STREAM-009: refresh local archive fallback cache for Liquidsoap',
  },
  {
    name: 'weekly-broadcast-reset',
    pattern: '0 0 * * 1',
    jobId: 'weekly-broadcast-reset-cron',
    description: 'M20: reset weekly broadcast counters (Monday 00:00 UTC)',
  },
  {
    name: 'tahti-selects-weekly-draw',
    pattern: '0 1 * * 1',
    jobId: 'tahti-selects-weekly-draw-cron',
    description:
      'Re-draw the Tahti Selects rotation from opted-in tracks (max 3/artist, 50 total; Monday 01:00 UTC)',
  },
  {
    name: 'fan-sub-payout',
    pattern: '0 4 * * *',
    jobId: 'fan-sub-payout-cron',
    description: 'M19: fan-sub Stripe Connect payouts (04:00 UTC)',
  },
  {
    name: 'fan-sub-expire',
    pattern: '0 5 * * *',
    jobId: 'fan-sub-expire-cron',
    description: 'M19: expire lapsed fan subscriptions (05:00 UTC)',
  },
  {
    name: 'fan-subscriber-purge',
    pattern: '0 5 * * *',
    jobId: 'fan-subscriber-purge-cron',
    description: 'M19: cancel stale fan-subs for deleted accounts (05:00 UTC)',
  },
  {
    name: 'tor-exit-list-sync',
    pattern: '30 5 * * *',
    jobId: 'tor-exit-list-sync-cron',
    description: 'M18: sync Tor exit CIDRs to Redis (05:30 UTC)',
  },
  {
    name: 'download-fraud-scan',
    pattern: '0 6 * * *',
    jobId: 'download-fraud-scan-cron',
    description: 'M18: download velocity fraud scan (06:00 UTC)',
  },
  {
    name: 'membership-renewal-reminder',
    pattern: '0 7 * * *',
    jobId: 'membership-renewal-reminder-cron',
    description: 'M1: membership renewal reminder emails (07:00 UTC)',
  },
  {
    name: 'mention-digest',
    pattern: '0 18 * * *',
    jobId: 'mention-digest-cron',
    description: 'M15: daily @-mention notification digest (18:00 UTC)',
  },
  {
    name: 'post-publish-notify',
    pattern: '* * * * *',
    jobId: 'post-publish-notify-cron',
    description: 'M34: notify followers when a scheduled post crosses its publishAt',
  },
  {
    name: 'membership-lapse',
    pattern: '0 8 * * *',
    jobId: 'membership-lapse-cron',
    description: 'M1: lapse memberships past renewal window (08:00 UTC)',
  },
  {
    name: 'revelator-royalty-sync',
    pattern: '0 4 5 * *',
    jobId: 'revelator-royalty-sync-cron',
    description: 'M7: pull Revelator royalty reports for prior month (5th, 04:00 UTC)',
  },
  {
    name: 'sweep-editor-peaks-backfill',
    pattern: '0 3 * * *',
    jobId: 'sweep-editor-peaks-backfill-cron',
    description:
      'PERF-04: backfill editorPeaks for READY archives missing pyramid data (03:00 UTC)',
  },
]
