// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import { registerCrons } from './lib/cron-scheduler.js'

const registered = await registerCrons()
console.log(`[cron-runner] ${registered} cron jobs registered (repeatables reset)`)

// Registration is persisted in Redis. Keep this explicit stack component alive
// so its deployment status makes scheduler ownership visible to operators.
const keepAlive = setInterval(() => undefined, 60 * 60 * 1000)

function shutdown() {
  clearInterval(keepAlive)
  process.exit(0)
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
