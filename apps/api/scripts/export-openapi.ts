// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildApp } from '../src/server.js'
import { mediaQueue } from '../src/lib/queue.js'

const repoRoot = resolve(import.meta.dirname, '../../..')
const app = await buildApp({ logger: false })
await app.ready()
const spec = app.swagger()
const outPath = resolve(repoRoot, 'openapi.json')
writeFileSync(outPath, JSON.stringify(spec, null, 2))
await app.close()
await mediaQueue.close()
console.log(`OpenAPI spec written — ${JSON.stringify(spec).length} bytes → ${outPath}`)
