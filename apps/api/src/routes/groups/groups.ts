// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2026 Tahti ry <https://tahti.live>

import type { FastifyPluginAsync } from 'fastify'
import meGroupRoutes from './me.js'
import meGroupSoundRoutes from './me-sounds.js'
import groupMemberRoutes from './members.js'
import publicGroupRoutes from './public.js'

const groupRoutes: FastifyPluginAsync = async (fastify) => {
  await fastify.register(meGroupRoutes)
  await fastify.register(meGroupSoundRoutes)
  await fastify.register(groupMemberRoutes)
  await fastify.register(publicGroupRoutes)
}

export default groupRoutes
