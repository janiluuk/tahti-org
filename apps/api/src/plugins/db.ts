// SPDX-License-Identifier: AGPL-3.0-or-later
// Copyright (C) 2024 Tahti ry <https://tahti.live>

import fp from 'fastify-plugin'
import type { FastifyPluginAsync } from 'fastify'
import { prisma } from '@tahti/db'

declare module 'fastify' {
  interface FastifyInstance {
    prisma: typeof prisma
  }
}

const dbPlugin: FastifyPluginAsync = async (fastify) => {
  fastify.decorate('prisma', prisma)

  fastify.addHook('onClose', async () => {
    await prisma.$disconnect()
  })
}

export default fp(dbPlugin, { name: 'db' })
