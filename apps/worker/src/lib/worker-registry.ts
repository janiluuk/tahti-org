// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Self-registration for the admin "worker nodes" view (apps/api/src/routes/
// admin/workers.ts). Deliberately no static list of hosts anywhere — a
// worker announces itself once at boot and heartbeats afterward, so the
// fleet the admin page shows always matches what's actually running instead
// of drifting from whatever the deploy topology looked like when someone
// last hand-maintained a list.
//
// A worker that stops heartbeating is NOT removed from `workers:known` —
// it keeps showing up as offline, which is the point of a status page.

import { createClient, type RedisClientType } from 'redis'
import os from 'node:os'

const KNOWN_SET_KEY = 'workers:known'
const HISTORY_LIMIT = 20

export type WorkerJobStatus = 'active' | 'completed' | 'failed'

export interface WorkerJobEvent {
  jobId: string
  jobName: string
  status: WorkerJobStatus
  at: number
  errorMessage?: string
}

function redisUrl(): string {
  return process.env.REDIS_URL ?? 'redis://localhost:6379'
}

export function resolveWorkerName(): string {
  return process.env.WORKER_NAME?.trim() || os.hostname()
}

let client: RedisClientType | null = null
let connectPromise: Promise<RedisClientType | null> | null = null

async function getClient(): Promise<RedisClientType | null> {
  if (client?.isOpen) return client
  if (!connectPromise) {
    connectPromise = (async () => {
      try {
        const c = createClient({ url: redisUrl() })
        c.on('error', (err) => {
          console.error('[worker-registry] redis error:', err)
        })
        await c.connect()
        client = c
        return client
      } catch (err) {
        console.error('[worker-registry] redis connect failed:', err)
        connectPromise = null
        return null
      }
    })()
  }
  return connectPromise
}

function workerKey(name: string): string {
  return `worker:${name}`
}

function historyKey(name: string): string {
  return `worker:${name}:history`
}

export async function registerWorker(name: string, lanes: string[]): Promise<void> {
  const c = await getClient()
  if (!c) return
  const now = String(Date.now())
  await c.sAdd(KNOWN_SET_KEY, name)
  await c.hSet(workerKey(name), {
    lanes: lanes.join(','),
    hostname: os.hostname(),
    pid: String(process.pid),
    startedAt: now,
    updatedAt: now,
    status: 'idle',
  })
}

export async function heartbeat(name: string): Promise<void> {
  const c = await getClient()
  if (!c) return
  await c.hSet(workerKey(name), { updatedAt: String(Date.now()) })
}

export async function recordJobEvent(name: string, event: WorkerJobEvent): Promise<void> {
  const c = await getClient()
  if (!c) return
  await c.hSet(workerKey(name), {
    updatedAt: String(event.at),
    status: event.status === 'active' ? 'processing' : 'idle',
    lastJobName: event.jobName,
    lastJobId: event.jobId,
    lastJobStatus: event.status,
    lastJobAt: String(event.at),
  })
  await c.lPush(historyKey(name), JSON.stringify(event))
  await c.lTrim(historyKey(name), 0, HISTORY_LIMIT - 1)
}
