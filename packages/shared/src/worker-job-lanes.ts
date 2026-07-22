// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * Which BullMQ job names belong to which worker lane — must cover every job name
 * used anywhere (see apps/worker/src/index.ts's dispatch and packages/shared's
 * WORKER_CRON_JOBS). infra/docker-stack.yml runs one differently-resourced
 * container per lane (worker-media: ffmpeg-heavy, recordings/hls/archive-cache
 * volumes; worker-dist: external distribution APIs; worker-light: cheap DB-only
 * cron work; worker-edge-log: Caddy access-log aggregation on the edge node only).
 * A job name missing from every lane here would never run on any container once
 * lane filtering is enabled — when adding a new job type, add it here too.
 */
export const WORKER_JOB_LANES = {
  media: [
    'transcode-archive',
    'transcode-archive-version',
    'transcode-release-track',
    'transcode-release-track-version',
    'render-archive-edit',
    'backfill-editor-peaks',
    'sweep-editor-peaks-backfill',
    'cloud-import-google-drive',
    'cloud-import-soundcloud',
    'finalize-broadcast-recording',
    'archive-broadcast',
    'warm-archive-fallback-cache',
    'archive-fallback-cache-sync',
    'hls-minio-sync',
    'channel-watchdog',
  ],
  dist: ['mixcloud-upload', 'revelator-deliver', 'revelator-royalty-sync', 'social-post-dispatch'],
  light: [
    'newsletter-dispatch',
    'monthly-ledger-rollup',
    'broadcast-cap-tick',
    'weekly-broadcast-reset',
    'tahti-selects-weekly-draw',
    'fan-sub-payout',
    'fan-sub-expire',
    'fan-subscriber-purge',
    'tor-exit-list-sync',
    'download-fraud-scan',
    'membership-renewal-reminder',
    'membership-lapse',
    'mention-digest',
    'annual-grant-calc',
  ],
  'edge-log': ['hls-caddy-egress-sync'],
} as const

export type WorkerLane = keyof typeof WORKER_JOB_LANES

export const ALL_WORKER_LANES = Object.keys(WORKER_JOB_LANES) as WorkerLane[]

export function isKnownWorkerLane(name: string): name is WorkerLane {
  return (ALL_WORKER_LANES as string[]).includes(name)
}

/** Expand a list of lane names (e.g. from --queues=media,dist) into allowed job names. */
export function jobNamesForLanes(lanes: readonly string[]): Set<string> {
  const names = new Set<string>()
  for (const lane of lanes) {
    if (isKnownWorkerLane(lane)) {
      for (const jobName of WORKER_JOB_LANES[lane]) names.add(jobName)
    }
  }
  return names
}
