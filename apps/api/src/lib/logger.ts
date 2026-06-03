// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyServerOptions } from 'fastify'
import { config } from '../config.js'

/** M11: pino JSON logs in production; quiet in tests unless overridden. */
export function apiLoggerConfig(
  override?: boolean | FastifyServerOptions['logger'],
): boolean | FastifyServerOptions['logger'] {
  if (override !== undefined) return override
  if (config.nodeEnv === 'test') return false
  return {
    level: process.env.LOG_LEVEL ?? (config.isProd ? 'info' : 'debug'),
  }
}
