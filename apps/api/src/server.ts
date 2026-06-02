// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.fi>

import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import sensible from '@fastify/sensible'
import dbPlugin from './plugins/db.js'
import authPlugin from './plugins/auth.js'
import healthRoute from './routes/health.js'
import sourceRoute from './routes/source.js'
import registerRoute from './routes/auth/register.js'
import verifyRoute from './routes/auth/verify.js'
import loginRoute from './routes/auth/login.js'
import logoutRoute from './routes/auth/logout.js'
import meRoute from './routes/auth/me.js'
import prepareUploadRoute from './routes/uploads/prepare.js'
import completeUploadRoute from './routes/uploads/complete.js'
import channelGetRoute from './routes/channels/get.js'
import channelItemsRoute from './routes/channels/items.js'
import itemReadyRoute from './routes/internal/item-ready.js'
import { config } from './config.js'

export interface BuildOptions {
  logger?: boolean | object
}

export async function buildApp(opts: BuildOptions = {}) {
  const fastify = Fastify({
    logger: opts.logger ?? config.nodeEnv !== 'test',
  })

  // Plugins
  await fastify.register(cookie)
  await fastify.register(sensible)
  await fastify.register(dbPlugin)
  await fastify.register(authPlugin)

  // Add Source-Code header for AGPL §13 compliance
  fastify.addHook('onSend', async (_request, reply) => {
    reply.header('Source-Code', config.sourceRepoUrl)
  })

  // Routes
  await fastify.register(healthRoute)
  await fastify.register(sourceRoute)
  await fastify.register(registerRoute)
  await fastify.register(verifyRoute)
  await fastify.register(loginRoute)
  await fastify.register(logoutRoute)
  await fastify.register(meRoute)
  await fastify.register(prepareUploadRoute)
  await fastify.register(completeUploadRoute)
  await fastify.register(channelGetRoute)
  await fastify.register(channelItemsRoute)
  await fastify.register(itemReadyRoute)

  return fastify
}
