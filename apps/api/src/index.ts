// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import { buildApp } from './server.js'
import { config } from './config.js'

const app = await buildApp()

try {
  await app.listen({ port: config.port, host: '0.0.0.0' })
} catch (err) {
  app.log.error(err)
  process.exit(1)
}
