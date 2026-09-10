// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyInstance } from 'fastify'
import { registerCoreRoutes } from './core.js'
import { registerAuthRoutes } from './auth.js'
import { registerChannelRoutes } from './channels.js'
import { registerInternalRoutes } from './internal.js'
import { registerChatRoutes } from './chat.js'
import { registerMoneyRoutes } from './money.js'
import { registerAdminRoutes } from './admin.js'
import { registerReleaseRoutes } from './releases.js'
import { registerIntegrationRoutes } from './integrations.js'
import { registerCommunityRoutes } from './community.js'
import { registerStudioRoutes } from './studio.js'
import { registerCollectionRoutes } from './collections.js'

export async function registerAllRoutes(fastify: FastifyInstance): Promise<void> {
  await registerCoreRoutes(fastify)
  await registerAuthRoutes(fastify)
  await registerChannelRoutes(fastify)
  await registerInternalRoutes(fastify)
  await registerChatRoutes(fastify)
  await registerMoneyRoutes(fastify)
  await registerAdminRoutes(fastify)
  await registerReleaseRoutes(fastify)
  await registerIntegrationRoutes(fastify)
  await registerCommunityRoutes(fastify)
  await registerStudioRoutes(fastify)
  await registerCollectionRoutes(fastify)
}
