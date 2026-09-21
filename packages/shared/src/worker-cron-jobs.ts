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
  /** Dispatcher jobs run several independent tasks in one tick. Each task is
   * logged to CronRun under its own name (so /admin/crons keeps per-task history)
   * and one task failing never stops the others. */
  subTasks?: string[]
}

/** Per-task view of the manifest: dispatchers expand into their sub-tasks. */
export function cronTaskNames(spec: CronJobSpec): string[] {
  return spec.subTasks ?? [spec.name]
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
    name: 'channel-fallback-reconciler',
    pattern: '* * * * *',
    jobId: 'channel-fallback-reconciler-cron',
    description: 'Bootstrap fallback-enabled artist channels into a running 24/7 container',
  },
  {
    name: 'sidecar-cleanup',
    pattern: '*/10 * * * *',
    jobId: 'sidecar-cleanup-cron',
    description:
      'Remove orphaned recorder/fingerprint sidecar containers left behind when a broadcast ends (no --rm, no broadcast-end hook — see services/orchestrator/src/sidecar-cleanup.ts)',
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
    name: 'sound-fallback-cache-sync',
    pattern: '*/10 * * * *',
    jobId: 'sound-fallback-cache-sync-cron',
    description: 'STREAM-009: refresh local sound fallback cache for Liquidsoap',
  },
  {
    name: 'weekly-monday',
    pattern: '0 0 * * 1',
    jobId: 'weekly-monday-cron',
    description: 'Monday 00:00 UTC: reset weekly broadcast counters, then re-draw Tahti Selects',
    subTasks: ['weekly-broadcast-reset', 'tahti-selects-weekly-draw'],
  },
  {
    name: 'fan-sub-daily',
    pattern: '0 4 * * *',
    jobId: 'fan-sub-daily-cron',
    description:
      'M19 daily 04:00 UTC: Stripe Connect payouts, expire lapsed subs, cancel subs of deleted accounts',
    subTasks: ['fan-sub-payout', 'fan-sub-expire', 'fan-subscriber-purge'],
  },
  {
    name: 'membership-daily',
    pattern: '0 7 * * *',
    jobId: 'membership-daily-cron',
    description:
      'M1 daily 07:00 UTC: renewal reminder emails, then lapse memberships past the window',
    subTasks: ['membership-renewal-reminder', 'membership-lapse'],
  },
  {
    name: 'media-daily-sweeps',
    pattern: '0 3 * * *',
    jobId: 'media-daily-sweeps-cron',
    description:
      'Daily 03:00 UTC: backfill missing editorPeaks (PERF-04), delete stem output past its 7-day retention',
    subTasks: ['sweep-editor-peaks-backfill', 'sweep-expired-stems'],
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
    name: 'listen-session-close',
    pattern: '*/3 * * * *',
    jobId: 'listen-session-close-cron',
    description: 'Close ListenSessions that stopped pinging (listen-time tracking)',
  },
  {
    name: 'revelator-royalty-sync',
    pattern: '0 4 5 * *',
    jobId: 'revelator-royalty-sync-cron',
    description: 'M7: pull Revelator royalty reports for prior month (5th, 04:00 UTC)',
  },
  {
    name: 'live-show-recurrence-generate',
    pattern: '15 3 * * *',
    jobId: 'live-show-recurrence-generate-cron',
    description:
      'Roll recurring LiveShowSeries forward: generate missing ScheduledLiveShow occurrences up to each series’ horizon (03:15 UTC)',
  },
  {
    name: 'missed-live-show-scan',
    pattern: '5 * * * *',
    jobId: 'missed-live-show-scan-cron',
    description:
      'Flag ScheduledLiveShows whose start time passed with no Broadcast, notify the board (5 min past the hour)',
  },
  {
    name: 'internet-radio-now-playing-sync',
    pattern: '*/10 * * * *',
    jobId: 'internet-radio-now-playing-sync-cron',
    description:
      "Refresh cached now-playing title for users' added internet radio stations whose host has a scraper (every 10 min)",
  },
]
