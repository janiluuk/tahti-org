#!/usr/bin/env node
// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

/** Fail fast when dev/CI runs on an unsupported Node (package.json engines: >=24). */
const requiredMajor = 24
const current = process.versions.node
const major = Number.parseInt(current.split('.')[0] ?? '', 10)

if (!Number.isFinite(major) || major < requiredMajor) {
  console.error(
    [
      `Tahti requires Node.js >= ${requiredMajor} (current: ${current}).`,
      'Use the version in .nvmrc:',
      '  nvm install && nvm use',
    ].join('\n'),
  )
  process.exit(1)
}
