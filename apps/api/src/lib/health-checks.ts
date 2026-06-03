// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { HeadBucketCommand } from '@aws-sdk/client-s3'
import type { PrismaClient } from '@tahti/db'
import { config } from '../config.js'
import { getRedisClient } from './redis.js'
import { s3 } from './minio.js'

export type DependencyState = 'up' | 'down' | 'skipped'

export interface DependencyCheck {
  /** Stable id for metrics labels (postgres, redis, minio, …). */
  id: string
  state: DependencyState
  critical: boolean
  latencyMs: number
  detail?: string
}

const CHECK_TIMEOUT_MS = 2500

async function withTimeout<T>(label: string, fn: () => Promise<T>): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} timed out`)), CHECK_TIMEOUT_MS)
    }),
  ])
}

function centrifugoHealthUrl(): string {
  const base = config.centrifugo.apiUrl.replace(/\/api\/?$/, '')
  return `${base}/health`
}

function ok(id: string, critical: boolean, latencyMs: number): DependencyCheck {
  return { id, state: 'up', critical, latencyMs }
}

function fail(id: string, critical: boolean, latencyMs: number, detail: string): DependencyCheck {
  return { id, state: 'down', critical, latencyMs, detail }
}

async function checkPostgres(prisma: PrismaClient): Promise<DependencyCheck> {
  const start = Date.now()
  try {
    await withTimeout('postgres', () => prisma.$queryRaw`SELECT 1`)
    return ok('postgres', true, Date.now() - start)
  } catch (err) {
    return fail('postgres', true, Date.now() - start, String(err))
  }
}

async function checkRedis(): Promise<DependencyCheck> {
  const start = Date.now()
  try {
    await withTimeout('redis', async () => {
      const client = await getRedisClient()
      if (!client) throw new Error('redis unavailable')
      const pong = await client.ping()
      if (pong !== 'PONG') throw new Error(`unexpected ping: ${pong}`)
    })
    return ok('redis', true, Date.now() - start)
  } catch (err) {
    return fail('redis', true, Date.now() - start, String(err))
  }
}

async function checkMinio(): Promise<DependencyCheck> {
  const start = Date.now()
  try {
    await withTimeout('minio', () =>
      s3.send(new HeadBucketCommand({ Bucket: config.minio.bucket })),
    )
    return ok('minio', true, Date.now() - start)
  } catch (err) {
    return fail('minio', true, Date.now() - start, String(err))
  }
}

async function checkHttp(id: string, url: string, critical: boolean): Promise<DependencyCheck> {
  const start = Date.now()
  try {
    await withTimeout(id, async () => {
      const res = await fetch(url, { signal: AbortSignal.timeout(CHECK_TIMEOUT_MS) })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
    })
    return ok(id, critical, Date.now() - start)
  } catch (err) {
    return fail(id, critical, Date.now() - start, String(err))
  }
}

export async function runDependencyChecks(prisma: PrismaClient): Promise<DependencyCheck[]> {
  const [postgres, redis, minio, centrifugo, orchestrator] = await Promise.all([
    checkPostgres(prisma),
    checkRedis(),
    checkMinio(),
    checkHttp('centrifugo', centrifugoHealthUrl(), false),
    checkHttp('orchestrator', `${config.orchestratorUrl.replace(/\/$/, '')}/health`, false),
  ])

  const icecastUrl = config.icecastBaseUrl.replace(/\/$/, '')
  const icecast = await checkHttp('icecast', `${icecastUrl}/`, false)

  return [postgres, redis, minio, centrifugo, orchestrator, icecast]
}

export function summarizeChecks(checks: DependencyCheck[]): {
  status: 'operational' | 'degraded' | 'outage'
  healthy: boolean
} {
  const criticalDown = checks.some((c) => c.critical && c.state === 'down')
  const anyDown = checks.some((c) => c.state === 'down')
  if (criticalDown) return { status: 'outage', healthy: false }
  if (anyDown) return { status: 'degraded', healthy: false }
  return { status: 'operational', healthy: true }
}

export function checksToRecord(checks: DependencyCheck[]): Record<string, string> {
  return Object.fromEntries(checks.map((c) => [c.id, c.state === 'up' ? 'up' : 'down']))
}

export function renderPrometheusMetrics(checks: DependencyCheck[], uptimeSec: number): string {
  const lines: string[] = [
    '# HELP tahti_dependency_up 1 when a dependency check succeeds.',
    '# TYPE tahti_dependency_up gauge',
    '# HELP tahti_dependency_check_latency_ms Last dependency check latency in milliseconds.',
    '# TYPE tahti_dependency_check_latency_ms gauge',
    '# HELP tahti_api_uptime_seconds API process uptime.',
    '# TYPE tahti_api_uptime_seconds gauge',
    `tahti_api_uptime_seconds ${uptimeSec}`,
  ]

  for (const check of checks) {
    const up = check.state === 'up' ? 1 : check.state === 'down' ? 0 : -1
    if (up >= 0) {
      lines.push(`tahti_dependency_up{dependency="${check.id}"} ${up}`)
      lines.push(`tahti_dependency_check_latency_ms{dependency="${check.id}"} ${check.latencyMs}`)
    }
  }

  const summary = summarizeChecks(checks)
  lines.push('# HELP tahti_api_healthy 1 when all critical dependencies are up.')
  lines.push('# TYPE tahti_api_healthy gauge')
  lines.push(`tahti_api_healthy ${summary.healthy ? 1 : 0}`)

  return `${lines.join('\n')}\n`
}
