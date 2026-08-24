// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/**
 * CI / release: export full + public OpenAPI JSON from the running route graph.
 *
 *   pnpm --filter @tahti/api exec tsx scripts/export-openapi.ts
 *
 * Writes (repo root):
 *   openapi.json         — full spec (includes admin; attach to GitHub releases)
 *   openapi.public.json  — public surface served at GET /api/openapi.json
 */
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { buildApp } from '../src/server.js'
import { mediaQueue, mediaQueueEvents } from '../src/lib/queue.js'
import { toPublicOpenApi } from '../src/lib/public-openapi.js'
import { config } from '../src/config.js'

const repoRoot = resolve(import.meta.dirname, '../../..')
const app = await buildApp({ logger: false })
await app.ready()
const spec = app.swagger() as Parameters<typeof toPublicOpenApi>[0]
const generatedAt = new Date().toISOString()
const publicSpec = toPublicOpenApi(spec, {
  serverUrl: config.apiUrl,
  generatedAt,
})

const fullPath = resolve(repoRoot, 'openapi.json')
const publicPath = resolve(repoRoot, 'openapi.public.json')
mkdirSync(dirname(fullPath), { recursive: true })
writeFileSync(fullPath, JSON.stringify(spec, null, 2))
writeFileSync(publicPath, JSON.stringify(publicSpec, null, 2))

await app.close()
await mediaQueue.close()
await mediaQueueEvents.close()

const pathCount = Object.keys(publicSpec.paths ?? {}).length
console.log(
  `OpenAPI written — full → ${fullPath}; public (${pathCount} paths) → ${publicPath} @ ${generatedAt}`,
)
// mediaQueueEvents holds an open ioredis subscriber connection that closing
// alone doesn't always release fast enough to let the event loop drain —
// without this, callers that wait on this process's exit (e.g. api-client's
// generate.mjs via execFileSync) can hang even after the work above is done.
process.exit(0)
