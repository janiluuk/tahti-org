// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'node',
    setupFiles: ['src/test/setup.ts'],
    env: {
      // Fall back to dev DB when DATABASE_URL is not set in the environment.
      // CI overrides this via workflow-level env vars.
      DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://tahti:tahti_dev@localhost:5432/tahti',
    },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/test/**'],
    },
  },
})
