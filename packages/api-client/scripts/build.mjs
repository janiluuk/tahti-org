#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Builds the publishable dist/ (ESM + .d.ts). tsc never emits or copies
// hand-placed .d.ts inputs, so the generated src/schema.d.ts is copied over
// explicitly — dist/index.d.ts imports its types from './schema.js'.
import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, readFileSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { resolve, dirname } from 'node:path'

const pkgRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const schemaSrc = resolve(pkgRoot, 'src/schema.d.ts')
const distDir = resolve(pkgRoot, 'dist')

// Without real schema types every path collapses to `never`/`any`, and the
// package would still build and publish — refuse instead.
const schema = existsSync(schemaSrc) ? readFileSync(schemaSrc, 'utf8') : ''
if (!/export interface paths \{/.test(schema) || !schema.includes('"/api/')) {
  console.error(
    '[api-client] src/schema.d.ts is missing or has no API paths — run `pnpm --filter @tahti/api-client generate` first',
  )
  process.exit(1)
}

rmSync(distDir, { recursive: true, force: true })
execFileSync('pnpm', ['exec', 'tsc', '-p', 'tsconfig.build.json'], {
  cwd: pkgRoot,
  stdio: 'inherit',
})
copyFileSync(schemaSrc, resolve(distDir, 'schema.d.ts'))
console.log('[api-client] built dist/')
