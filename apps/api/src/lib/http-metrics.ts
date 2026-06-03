// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

type StatusClass = '2xx' | '3xx' | '4xx' | '5xx' | 'other'

const requestCounts: Record<StatusClass, number> = {
  '2xx': 0,
  '3xx': 0,
  '4xx': 0,
  '5xx': 0,
  other: 0,
}

let durationMsSum = 0
let durationMsCount = 0

export function statusClass(statusCode: number): StatusClass {
  if (statusCode >= 200 && statusCode < 300) return '2xx'
  if (statusCode >= 300 && statusCode < 400) return '3xx'
  if (statusCode >= 400 && statusCode < 500) return '4xx'
  if (statusCode >= 500) return '5xx'
  return 'other'
}

/** Record one HTTP response (skipped for health/metrics in request-log). */
export function recordHttpRequest(statusCode: number, durationMs: number): void {
  requestCounts[statusClass(statusCode)] += 1
  durationMsSum += durationMs
  durationMsCount += 1
}

/** Reset counters — for tests only. */
export function resetHttpMetricsForTests(): void {
  for (const key of Object.keys(requestCounts) as StatusClass[]) {
    requestCounts[key] = 0
  }
  durationMsSum = 0
  durationMsCount = 0
}

export function renderHttpMetricLines(): string[] {
  const lines = [
    '# HELP tahti_http_requests_total HTTP requests since process start by status class.',
    '# TYPE tahti_http_requests_total counter',
    '# HELP tahti_http_request_duration_ms_sum Sum of response times (ms) since process start.',
    '# TYPE tahti_http_request_duration_ms_sum counter',
    '# HELP tahti_http_request_duration_ms_count HTTP responses counted for duration sum.',
    '# TYPE tahti_http_request_duration_ms_count counter',
  ]

  for (const [cls, count] of Object.entries(requestCounts) as [StatusClass, number][]) {
    lines.push(`tahti_http_requests_total{status_class="${cls}"} ${count}`)
  }
  lines.push(`tahti_http_request_duration_ms_sum ${durationMsSum}`)
  lines.push(`tahti_http_request_duration_ms_count ${durationMsCount}`)

  return lines
}
