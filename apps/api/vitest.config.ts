// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Shared Postgres — run test files sequentially to avoid memberNumber races.
    fileParallelism: false,
    environment: 'node',
    setupFiles: ['src/test/env.ts', 'src/test/setup.ts'],
    env: {
      // Fall back to dev DB when DATABASE_URL is not set in the environment.
      // CI overrides this via workflow-level env vars.
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://tahti:tahti_dev@localhost:5432/tahti',
      // Valid 32-byte hex key (invalid values in the shell env break RTMP target tests).
      RTMP_KEY_ENC_KEY: 'dev0000000000000000000000000000000000000000000000000000000000000',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    },
  },
})
