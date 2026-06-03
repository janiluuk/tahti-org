// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { defineConfig } from 'vitest/config'

// Single worker across workspace projects — shared Postgres, reserved memberNumbers.
export default defineConfig({
  test: {
    maxWorkers: 1,
    fileParallelism: false,
  },
})
