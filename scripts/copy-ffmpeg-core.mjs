#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>
/** Copy @ffmpeg/core(+mt) WASM bundles into apps/web/public for same-origin loading (SEC-05). */

import { cp, mkdir, access } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const webModules = join(root, 'apps/web/node_modules')
const outRoot = join(root, 'apps/web/public/static/ffmpeg')
const version = '0.12.10'

const packages = [
  { name: '@ffmpeg/core', dir: `core-${version}` },
  { name: '@ffmpeg/core-mt', dir: `core-mt-${version}` },
]

async function copyPkg({ name, dir }) {
  const pkgPath = join(webModules, name)
  try {
    await access(join(pkgPath, 'package.json'))
  } catch {
    console.warn(`[copy-ffmpeg-core] skip ${name} — not installed`)
    return
  }
  const src = join(pkgPath, 'dist/esm')
  const dest = join(outRoot, dir)
  await mkdir(dest, { recursive: true })
  for (const file of ['ffmpeg-core.js', 'ffmpeg-core.wasm', 'ffmpeg-core.worker.js']) {
    try {
      await cp(join(src, file), join(dest, file))
    } catch {
      if (file === 'ffmpeg-core.worker.js') continue
      throw new Error(`Missing ${file} in ${src}`)
    }
  }
  console.log(`[copy-ffmpeg-core] ${dir}`)
}

await mkdir(outRoot, { recursive: true })
for (const pkg of packages) {
  await copyPkg(pkg)
}
