// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { exec } from 'node:child_process'
import { promisify } from 'node:util'
import type { PrismaClient } from '@tahti/db'
import { recorderContainerName } from './recorder.js'
import { fingerprintContainerName } from './fingerprint-ingest.js'

const execAsync = promisify(exec)

/** Recorder/fingerprint sidecars are only ever stopped via the in-memory
 * activeRecorders/activeFingerprintIngest maps in recorder.ts/fingerprint-ingest.ts,
 * which are wiped on every orchestrator restart and are never populated for a
 * broadcast that ended while the orchestrator itself was down or between deploys.
 * Neither container is spawned with --rm, and the normal broadcast-end path
 * (apps/api/src/routes/internal/icecast.ts, rtmp.ts) only updates Postgres — it
 * never calls the orchestrator at all. The result: any sidecar for a broadcast
 * that ended outside those two in-memory maps' lifetime is orphaned forever,
 * either sitting `Up` indefinitely (fingerprint's shell loop never exits on its
 * own) or `Exited` and never removed (recorder). Confirmed in production: 48
 * such containers had accumulated, 25 of them still running, oldest 5 days.
 *
 * This sweep is independent of that in-memory tracking on purpose — it asks
 * Docker and Postgres directly which sidecars *should* still exist (one
 * recorder + one fingerprint container per currently-open broadcast) and
 * removes everything else with a `tahti-recorder-`/`tahti-fp-` name that
 * doesn't match. */
export async function cleanupOrphanedSidecars(
  prisma: PrismaClient,
): Promise<{ checked: number; removed: string[] }> {
  const openBroadcasts = await prisma.broadcast.findMany({
    where: { endedAt: null },
    select: { id: true, channel: { select: { slug: true } } },
  })

  const protectedNames = new Set<string>()
  for (const b of openBroadcasts) {
    protectedNames.add(recorderContainerName(b.channel.slug, b.id))
    protectedNames.add(fingerprintContainerName(b.channel.slug, b.id))
  }

  const { stdout } = await execAsync(`docker ps -a --format '{{.Names}}'`).catch(() => ({
    stdout: '',
  }))
  const allNames = stdout
    .split('\n')
    .map((n) => n.trim())
    .filter(Boolean)
  const sidecarNames = allNames.filter(
    (n) => n.startsWith('tahti-recorder-') || n.startsWith('tahti-fp-'),
  )

  const toRemove = sidecarNames.filter((n) => !protectedNames.has(n))
  const removed: string[] = []
  for (const name of toRemove) {
    try {
      await execAsync(`docker rm -f ${name}`)
      removed.push(name)
    } catch {
      // Already gone — fine.
    }
  }

  return { checked: sidecarNames.length, removed }
}
