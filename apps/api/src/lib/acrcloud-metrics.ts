// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** M11: in-process ACRCloud identify counters (cost / usage watchdog via /metrics). */

let requestsTotal = 0
let matchesTotal = 0
let missesTotal = 0

/** Test-only reset — counters are process-global for Prometheus scraping. */
export function resetAcrcloudMetricsForTest(): void {
  requestsTotal = 0
  matchesTotal = 0
  missesTotal = 0
}

export function recordAcrcloudIdentifyRequest(): void {
  requestsTotal++
}

export function recordAcrcloudIdentifyMatch(): void {
  matchesTotal++
}

export function recordAcrcloudIdentifyMiss(): void {
  missesTotal++
}

export function renderAcrcloudMetricLines(): string[] {
  return [
    '# HELP tahti_acrcloud_identify_requests_total ACRCloud audio identify API calls at ingest.',
    '# TYPE tahti_acrcloud_identify_requests_total counter',
    `tahti_acrcloud_identify_requests_total ${requestsTotal}`,
    '# HELP tahti_acrcloud_identify_matches_total ACRCloud identify responses with a track match.',
    '# TYPE tahti_acrcloud_identify_matches_total counter',
    `tahti_acrcloud_identify_matches_total ${matchesTotal}`,
    '# HELP tahti_acrcloud_identify_misses_total ACRCloud identify calls with no match or API error.',
    '# TYPE tahti_acrcloud_identify_misses_total counter',
    `tahti_acrcloud_identify_misses_total ${missesTotal}`,
  ]
}
