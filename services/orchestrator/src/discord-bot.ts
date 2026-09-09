// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

// Restarts the `radio-discord-bot` Compose service. Unlike every other
// container this orchestrator manages, it didn't spawn this one — Compose
// did, at stack-up time — so it's found by its compose service label rather
// than a name this process assigned itself.

import { exec } from 'node:child_process'
import { promisify } from 'node:util'

const execAsync = promisify(exec)

const COMPOSE_SERVICE_LABEL = 'com.docker.compose.service=radio-discord-bot'

export class DiscordBotNotRunningError extends Error {
  constructor() {
    super('radio-discord-bot container not found or not running')
  }
}

export async function restartDiscordBotContainer(): Promise<{ container: string }> {
  const { stdout } = await execAsync(
    `docker ps --filter "label=${COMPOSE_SERVICE_LABEL}" --filter "status=running" --format '{{.Names}}'`,
  ).catch(() => ({ stdout: '' }))
  const container = stdout
    .split('\n')
    .map((name) => name.trim())
    .filter(Boolean)[0]

  if (!container) {
    throw new DiscordBotNotRunningError()
  }

  await execAsync(`docker restart "${container}"`)
  return { container }
}
