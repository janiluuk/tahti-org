#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Regenerates @tahti/api-client's types from apps/api's own route graph.
// Two steps because openapi-typescript needs a spec file on disk, and the
// spec is derived from Fastify's live schemas rather than hand-maintained:
//
//   1. apps/api/scripts/export-openapi.ts builds the Fastify app (no network
//      listener) and writes openapi.json (full spec, incl. admin/internal —
//      the SDK deliberately covers the whole API, not just the public docs
//      subset) to the repo root.
//   2. openapi-typescript turns that spec into src/schema.d.ts here.
//
// Run via `pnpm --filter @tahti/api-client generate`, or let turbo run it
// automatically (see turbo.json — apps/web's dev/build/typecheck depend on
// this package's `generate` task, keyed on apps/api's route/schema sources).
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../..')

console.log('[api-client] exporting openapi.json from apps/api...')
execFileSync('pnpm', ['--filter', '@tahti/api', 'run', 'openapi:export'], {
  cwd: repoRoot,
  stdio: 'inherit',
})

console.log('[api-client] generating schema.d.ts...')
execFileSync(
  'pnpm',
  [
    'exec',
    'openapi-typescript',
    resolve(repoRoot, 'openapi.json'),
    '-o',
    resolve(here, '../src/schema.d.ts'),
  ],
  { cwd: repoRoot, stdio: 'inherit' },
)

console.log('[api-client] done.')
